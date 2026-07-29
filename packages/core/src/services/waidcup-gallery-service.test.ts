import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readWaidcupGallery } from "./waidcup-gallery-service.js";

function makeGallery(files: Record<string, string[]>): string {
  const root = mkdtempSync(join(tmpdir(), "gallery-"));
  for (const [dir, names] of Object.entries(files)) {
    mkdirSync(join(root, dir), { recursive: true });
    for (const name of names) writeFileSync(join(root, dir, name), "x");
  }
  return root;
}

test("readWaidcupGallery: Jahre neueste zuerst, Tage chronologisch, Bilder sortiert", () => {
  const root = makeGallery({
    "2026/2026-07-25/thumb": ["b.webp", "a.webp"],
    "2026/2026-07-25/large": ["b.webp", "a.webp"],
    "2026/2026-07-18/thumb": ["x.webp"],
    "2026/2026-07-18/large": ["x.webp"],
    "2027/2027-07-24/thumb": ["z.webp"],
    "2027/2027-07-24/large": ["z.webp"],
  });
  try {
    const gallery = readWaidcupGallery(root);
    assert.deepEqual(gallery.years.map((y) => y.year), [2027, 2026]); // neueste zuerst
    const y2026 = gallery.years.find((y) => y.year === 2026)!;
    assert.deepEqual(y2026.days.map((d) => d.day), ["2026-07-18", "2026-07-25"]); // chronologisch
    assert.deepEqual(y2026.days[1]!.images, ["a.webp", "b.webp"]); // sortiert
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readWaidcupGallery: ignoriert Fremddateien, Nicht-WebP und unpassend benannte Ordner", () => {
  const root = makeGallery({
    "2026/2026-07-18/thumb": ["ok.webp", "notes.txt", "raw.jpg"],
    "2026/2026-07-18/large": ["ok.webp"],
    "2026/kein-tag/thumb": ["ignored.webp"],
    "archiv/2026-07-18/thumb": ["ignored.webp"],
  });
  try {
    const gallery = readWaidcupGallery(root);
    assert.equal(gallery.years.length, 1);
    assert.deepEqual(gallery.years[0]!.days.map((d) => d.day), ["2026-07-18"]);
    assert.deepEqual(gallery.years[0]!.days[0]!.images, ["ok.webp"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readWaidcupGallery: nur Bilder mit Kachel UND Grossbild; leere Tage/Jahre fallen weg", () => {
  const root = makeGallery({
    // "nur-thumb.webp" fehlt in large/ → darf nicht erscheinen
    "2026/2026-07-18/thumb": ["paar.webp", "nur-thumb.webp"],
    "2026/2026-07-18/large": ["paar.webp"],
    // Tag ohne jedes Bild → fällt weg
    "2026/2026-07-19/thumb": [],
    "2026/2026-07-19/large": [],
  });
  try {
    const gallery = readWaidcupGallery(root);
    assert.deepEqual(gallery.years[0]!.days.map((d) => d.day), ["2026-07-18"]);
    assert.deepEqual(gallery.years[0]!.days[0]!.images, ["paar.webp"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readWaidcupGallery: fehlendes Verzeichnis liefert leere Galerie statt Fehler", () => {
  assert.deepEqual(readWaidcupGallery(join(tmpdir(), "gibt-es-nicht-4711")), { years: [] });
});

test("Version ändert sich, wenn ein Bild ersetzt wird (sonst zeigt der Browser die alte Fassung)", () => {
  const root = makeGallery({
    "2026/2026-07-25/thumb": ["a.webp"],
    "2026/2026-07-25/large": ["a.webp"],
  });
  try {
    const vorher = readWaidcupGallery(root).years[0]!.days[0]!.version;
    // Ersetzt wie beim erneuten Export: gleicher Name, neuer Inhalt/Zeitstempel.
    const file = join(root, "2026/2026-07-25/thumb/a.webp");
    writeFileSync(file, "neuer inhalt");
    const spaeter = new Date(Date.now() + 5000);
    utimesSync(file, spaeter, spaeter);

    const nachher = readWaidcupGallery(root).years[0]!.days[0]!.version;
    assert.notEqual(nachher, vorher);
    assert.match(nachher, /^[0-9a-z]+$/); // URL-tauglich
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Version bleibt stabil, solange sich nichts ändert", () => {
  const root = makeGallery({
    "2026/2026-07-25/thumb": ["a.webp", "b.webp"],
    "2026/2026-07-25/large": ["a.webp", "b.webp"],
  });
  try {
    const erste = readWaidcupGallery(root).years[0]!.days[0]!.version;
    assert.equal(readWaidcupGallery(root).years[0]!.days[0]!.version, erste);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
