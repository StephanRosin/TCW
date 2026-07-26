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

function photoUrl(year: number, day: string, variant: "thumb" | "large", name: string): string {
  return `/gallery/${year}/${day}/${variant}/${encodeURIComponent(name)}`;
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
        thumb: photoUrl(year.year, entry.day, "thumb", name),
        large: photoUrl(year.year, entry.day, "large", name),
      })),
    );
}
