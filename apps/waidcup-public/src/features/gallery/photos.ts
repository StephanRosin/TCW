/**
 * Übersetzt die Galerie-Antwort des Servers (Jahre → Tage → Dateinamen) in die
 * flache Bildliste, die Kachelraster und Lightbox anzeigen. Die Bild-URLs folgen
 * derselben Ordnerstruktur, die der Server unter `/gallery/` ausliefert.
 */
import type { WaidcupGalleryYear } from "@tcw/shared";

export interface GalleryPhoto {
  /** Eindeutig über alle Tage hinweg (Tag + Dateiname). */
  id: string;
  day: string;
  thumb: string;
  large: string;
}

/**
 * Bild-URL mit Versionskennzeichen: die Dateinamen bleiben über Jahre gleich,
 * der Inhalt kann sich aber ändern (neuer Export). Ohne den Parameter zeigte
 * der lange Browser-Cache weiterhin die alte Fassung.
 */
function photoUrl(
  year: number,
  day: string,
  variant: "thumb" | "large",
  name: string,
  version: string,
): string {
  const path = `/gallery/${year}/${day}/${variant}/${encodeURIComponent(name)}`;
  return version === "" ? path : `${path}?v=${encodeURIComponent(version)}`;
}

/** Alle Bilder eines Jahrgangs, chronologisch; `day` filtert auf einen Tag. */
export function photosOf(year: WaidcupGalleryYear | undefined, day: string | null): GalleryPhoto[] {
  if (!year) return [];
  return year.days
    .filter((entry) => day === null || entry.day === day)
    .flatMap((entry) =>
      entry.images.map((name) => ({
        id: `${entry.day}/${name}`,
        day: entry.day,
        thumb: photoUrl(year.year, entry.day, "thumb", name, entry.version),
        large: photoUrl(year.year, entry.day, "large", name, entry.version),
      })),
    );
}
