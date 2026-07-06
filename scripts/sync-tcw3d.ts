/**
 * Kopiert die eigenständige 3D-Rundgang-App (separates Repo) als Snapshot in
 * die statischen Assets der Waidcup-Seite, damit sie unter /tcw3d/ ausgeliefert
 * wird. Idempotent: Zielordner wird vorher geleert. Kopiert nur die Laufzeit-
 * Dateien der App (Allowlist) und lässt die copyright-geschützten Musik-Tracks
 * (assets/audio, im Quell-Repo bewusst nie eingecheckt) draussen.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const SRC = process.env.TCW3D_SRC ?? join(homedir(), "Dokumente/TCW3D/3DTCW");
const DEST = resolve(process.cwd(), "apps/waidcup-public/public/tcw3d");

// Allowlist statt Ausschluss: so landen künftige Nicht-Laufzeit-Ordner des
// Quell-Repos (docs, .superpowers, …) nicht versehentlich im öffentlichen Snapshot.
const RUNTIME_ENTRIES = ["index.html", "js", "vendor", "assets"];
// Copyright-geschützte Terrassen-Musik: im Quell-Repo bewusst nie eingecheckt.
const EXCLUDE_WITHIN = ["assets/audio"];

function directorySizeBytes(dir: string): number {
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    bytes += entry.isDirectory() ? directorySizeBytes(full) : statSync(full).size;
  }
  return bytes;
}

if (!existsSync(join(SRC, "index.html"))) {
  throw new Error(`3D-App nicht gefunden unter ${SRC} (index.html fehlt). TCW3D_SRC setzen?`);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

let count = 0;
for (const entry of RUNTIME_ENTRIES) {
  const from = join(SRC, entry);
  if (!existsSync(from)) continue;
  cpSync(from, join(DEST, entry), { recursive: true });
  count += 1;
}

// Ausschlüsse innerhalb kopierter Ordner nachträglich entfernen.
for (const rel of EXCLUDE_WITHIN) {
  rmSync(join(DEST, rel), { recursive: true, force: true });
}

// Node-Unit-Tests (*.test.js) gehören nicht in den öffentlichen Browser-Snapshot.
function removeTestFiles(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) removeTestFiles(full);
    else if (entry.name.endsWith(".test.js")) rmSync(full);
  }
}
removeTestFiles(DEST);

console.log(
  `3D-App synchronisiert: ${count} Einträge, ~${(directorySizeBytes(DEST) / 1024 / 1024).toFixed(1)} MB → ${DEST}`,
);
