/**
 * Fotogalerie des Waidcups: liest die auf der Platte liegende Ordnerstruktur
 *
 *   <wurzel>/<jahr>/<jahr-monat-tag>/thumb/<name>.webp   (Kachel)
 *   <wurzel>/<jahr>/<jahr-monat-tag>/large/<name>.webp   (Lightbox)
 *
 * Es gibt bewusst keine Index-Datei und keinen Datenbankeintrag: ein neuer
 * Jahrgang ist allein durch Hochladen des Ordners vollständig – ohne Code-
 * Änderung und ohne Deploy. Aufgeführt wird nur, was in beiden Varianten
 * vorliegt; alles andere (Fremddateien, halbe Konvertierungen) wird ignoriert.
 * Die Bilder selbst liefert der Server statisch unter `/gallery/` aus.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { WaidcupGalleryDay, WaidcupGalleryResponse, WaidcupGalleryYear } from "@tcw/shared";

const YEAR_DIR = /^\d{4}$/;
const DAY_DIR = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE = /\.webp$/i;

/** Verzeichnisnamen einer Ebene; fehlt der Pfad, ist die Liste leer. */
function subdirectories(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/** Dateinamen einer Ebene, gefiltert nach Endung; fehlt der Pfad, ist die Liste leer. */
function readNames(path: string, pattern: RegExp): string[] {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isFile() && pattern.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function imageNames(path: string): string[] {
  return readNames(path, IMAGE);
}

/**
 * Kennzeichen des Bildstands: jüngste Änderungszeit der Kacheln, in Sekunden
 * und Basis 36. Werden Bilder ersetzt oder ergänzt, ändert sich der Wert – und
 * damit die Bild-URLs, sodass Browser die neuen Dateien laden statt der lange
 * zwischengespeicherten alten.
 */
function versionOf(thumbDir: string, images: string[]): string {
  let newest = 0;
  for (const name of images) {
    try {
      const { mtimeMs } = statSync(join(thumbDir, name));
      if (mtimeMs > newest) newest = mtimeMs;
    } catch {
      // Datei verschwand zwischen Auflisten und Prüfen – für die Version egal.
    }
  }
  return Math.floor(newest / 1000).toString(36);
}

/** Liegt zu jedem Bild eine JPEG-Fassung? Nur dann wird sie zum Download angeboten. */
function jpegCovers(dayPath: string, images: string[]): boolean {
  const jpegs = new Set(
    readNames(join(dayPath, "jpg"), /\.jpe?g$/i).map((name) => name.replace(/\.jpe?g$/i, "")),
  );
  return jpegs.size > 0 && images.every((name) => jpegs.has(name.replace(/\.webp$/i, "")));
}

/** Bilder eines Tages: Dateiname muss als Kachel und als Grossbild existieren. */
function readDay(dayPath: string, day: string): WaidcupGalleryDay | null {
  const thumbDir = join(dayPath, "thumb");
  const large = new Set(imageNames(join(dayPath, "large")));
  const images = imageNames(thumbDir)
    .filter((name) => large.has(name))
    .sort((a, b) => a.localeCompare(b));
  if (images.length === 0) return null;
  return {
    day,
    images,
    version: versionOf(thumbDir, images),
    downloadVariant: jpegCovers(dayPath, images) ? "jpg" : "large",
  };
}

function readYear(yearPath: string, year: number): WaidcupGalleryYear | null {
  const days = subdirectories(yearPath)
    .filter((name) => DAY_DIR.test(name))
    .sort((a, b) => a.localeCompare(b)) // chronologisch: Turniertag 1 zuerst
    .map((name) => readDay(join(yearPath, name), name))
    .filter((day): day is WaidcupGalleryDay => day !== null);
  return days.length === 0 ? null : { year, days };
}

export function readWaidcupGallery(galleryDir: string): WaidcupGalleryResponse {
  const years = subdirectories(galleryDir)
    .filter((name) => YEAR_DIR.test(name))
    .map((name) => readYear(join(galleryDir, name), Number(name)))
    .filter((year): year is WaidcupGalleryYear => year !== null)
    .sort((a, b) => b.year - a.year); // neuester Jahrgang zuerst
  return { years };
}
