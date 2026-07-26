/**
 * Rechnet die Waidcup-Originalfotos auf zwei webtaugliche WebP-Varianten herunter
 * und legt sie in der Struktur ab, die der Server unter `/gallery/` ausliefert:
 *
 *   <out>/<jahr>/<jahr-monat-tag>/thumb/<name>.webp   (Kachel, 800px)
 *   <out>/<jahr>/<jahr-monat-tag>/large/<name>.webp   (Lightbox, 3200px)
 *
 * Die Quellordner heissen `JJJJMMTT` (z. B. 20260718); daraus werden Jahr und Tag
 * abgeleitet. `-auto-orient` dreht Hochformate nach EXIF gerade. Bereits erzeugte
 * und aktuelle Dateien werden übersprungen, der Lauf ist also wiederholbar.
 *
 * Aufruf:
 *   npx tsx scripts/build-gallery-images.ts --in <quelle> --out <ziel>
 * Voraussetzung: ImageMagick (`magick`) im PATH.
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const THUMB = { dir: "thumb", size: 800, quality: 82 };
const LARGE = { dir: "large", size: 3200, quality: 85 };

const SOURCE_EXT = new Set([".jpg", ".jpeg", ".png"]);
const DAY_DIR = /^(\d{4})(\d{2})(\d{2})$/;

interface Job {
  source: string;
  target: string;
  size: number;
  quality: number;
}

function parseArgs(argv: string[]): { inDir: string; outDir: string } {
  const value = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index >= 0 && argv[index + 1] ? argv[index + 1]! : fallback;
  };
  return {
    inDir: value("--in", `${process.env.HOME}/Nextcloud/Waidcup/Bilder`),
    outDir: value("--out", `${process.env.HOME}/waidcup-gallery`),
  };
}

/** Quelle ist neuer als das Ziel (oder Ziel fehlt) → neu erzeugen. */
async function needsBuild(source: string, target: string): Promise<boolean> {
  try {
    const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target)]);
    return sourceStat.mtimeMs > targetStat.mtimeMs;
  } catch {
    return true;
  }
}

async function collectJobs(inDir: string, outDir: string): Promise<Job[]> {
  const jobs: Job[] = [];
  for (const entry of await readdir(inDir, { withFileTypes: true })) {
    const match = DAY_DIR.exec(entry.name);
    if (!entry.isDirectory() || !match) continue;
    const [, year, month, day] = match;
    const dayDir = join(outDir, year!, `${year}-${month}-${day}`);
    for (const variant of [THUMB, LARGE]) {
      await mkdir(join(dayDir, variant.dir), { recursive: true });
    }
    for (const file of await readdir(join(inDir, entry.name))) {
      if (!SOURCE_EXT.has(extname(file).toLowerCase())) continue;
      const source = join(inDir, entry.name, file);
      const name = `${basename(file, extname(file))}.webp`;
      for (const variant of [THUMB, LARGE]) {
        const target = join(dayDir, variant.dir, name);
        if (await needsBuild(source, target)) {
          jobs.push({ source, target, size: variant.size, quality: variant.quality });
        }
      }
    }
  }
  return jobs;
}

async function convert(job: Job): Promise<void> {
  await run("magick", [
    job.source,
    "-auto-orient",
    "-resize",
    `${job.size}x${job.size}`,
    "-quality",
    String(job.quality),
    job.target,
  ]);
}

/** Arbeitet die Warteschlange mit begrenzter Parallelität ab. */
async function runAll(jobs: Job[]): Promise<void> {
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      await convert(job);
      done += 1;
      if (done % 20 === 0 || done === jobs.length) {
        console.log(`  ${done}/${jobs.length} Varianten erzeugt`);
      }
    }
  };
  const workers = Math.min(availableParallelism(), 8, jobs.length);
  await Promise.all(Array.from({ length: workers }, worker));
}

async function main(): Promise<void> {
  const { inDir, outDir } = parseArgs(process.argv.slice(2));
  console.log(`Galerie-Bilder: ${inDir} → ${outDir}`);
  const jobs = await collectJobs(inDir, outDir);
  if (jobs.length === 0) {
    console.log("Alles aktuell – nichts zu tun.");
    return;
  }
  console.log(`${jobs.length} Varianten zu erzeugen …`);
  await runAll(jobs);
  console.log("Fertig.");
}

main().catch((error: unknown) => {
  console.error("Galerie-Bilder fehlgeschlagen:", error);
  process.exit(1);
});
