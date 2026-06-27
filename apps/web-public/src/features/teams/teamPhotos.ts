/**
 * Zuordnung Teamname → Teamfoto. Die Dateien liegen unter
 * `public/team-photos/<slug>.<ext>`; der Slug ergibt sich deterministisch aus
 * dem Anzeigenamen (Geschlecht + Kategorie + Liga). Teams ohne Foto (55+ Herren)
 * fehlen im Manifest.
 */
const PHOTO_FILES: Record<string, string> = {
  "damen-aktiv-nlc": "damen-aktiv-nlc.jpeg",
  "damen-aktiv-1-liga": "damen-aktiv-1-liga.jpeg",
  "damen-aktiv-2-liga": "damen-aktiv-2-liga.jpeg",
  "damen-30-nlc": "damen-30-nlc.jpeg",
  "damen-30-1-liga": "damen-30-1-liga.png",
  "damen-30-3-liga": "damen-30-3-liga.jpeg",
  "herren-aktiv-nlc": "herren-aktiv-nlc.jpeg",
  "herren-aktiv-1-liga": "herren-aktiv-1-liga.jpeg",
  "herren-aktiv-2-liga": "herren-aktiv-2-liga.jpeg",
  "herren-35-nlc": "herren-35-nlc.jpg",
  "herren-35-1-liga": "herren-35-1-liga.jpeg",
  "herren-35-2-liga": "herren-35-2-liga.jpeg",
  "herren-45-2-liga": "herren-45-2-liga.jpeg",
};

function teamSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Foto-URL des Teams oder null, wenn kein Foto vorhanden ist. */
export function teamPhotoUrl(title: string): string | null {
  const file = PHOTO_FILES[teamSlug(title)];
  return file ? `/team-photos/${file}` : null;
}
