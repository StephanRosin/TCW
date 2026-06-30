/**
 * Zuordnung Teamname → Teamfoto. Die Dateien liegen unter
 * `public/team-photos/<slug>.<ext>`; der Slug ergibt sich deterministisch aus
 * dem Anzeigenamen (Geschlecht + Kategorie + Liga). Teams ohne Foto fehlen im
 * Manifest.
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
  "herren-55-3-liga": "herren-55-3-liga.jpeg",
};

/**
 * Vertikaler Bildausschnitt (background-position-y) je Team für den Foto-
 * Hintergrund der Spielerliste. Höherer Wert = Ausschnitt weiter unten im Bild.
 * Pro Foto so gewählt, dass die Köpfe nicht abgeschnitten werden (Hochformat-
 * und Zwei-Reihen-Bilder brauchen tiefere Werte). Default siehe CSS.
 */
const PHOTO_FOCUS_Y: Record<string, string> = {
  "damen-aktiv-nlc": "42%",
  "damen-aktiv-1-liga": "32%",
  "damen-aktiv-2-liga": "30%",
  "damen-30-nlc": "50%",
  "damen-30-1-liga": "38%",
  "damen-30-3-liga": "30%",
  "herren-aktiv-nlc": "90%",
  "herren-aktiv-1-liga": "30%",
  "herren-aktiv-2-liga": "32%",
  "herren-35-nlc": "33%",
  "herren-35-1-liga": "35%",
  "herren-35-2-liga": "37%",
  "herren-45-2-liga": "30%",
  "herren-55-3-liga": "35%",
};

/**
 * Optionaler Zoom (background-size) je Team. Default ist `cover` (siehe CSS).
 * Nötig nur, wo `cover` die Personen zu klein zeigt (z. B. Hochformat mit viel
 * Rand) – stärker reinzoomen, seitlicher Beschnitt ist gewollt.
 */
const PHOTO_ZOOM: Record<string, string> = {
  "herren-aktiv-nlc": "125% auto",
};

function teamSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Foto-URL des Teams (volle Auflösung, für das Modal) oder null. */
export function teamPhotoUrl(title: string): string | null {
  const file = PHOTO_FILES[teamSlug(title)];
  return file ? `/team-photos/${file}` : null;
}

/**
 * Verkleinerte Panel-Version (max. 900px, JPEG) für den Karten-Hintergrund –
 * lädt deutlich schneller als das Original. Liegt unter `team-photos/panel/`.
 */
export function teamPhotoPanelUrl(title: string): string | null {
  const slug = teamSlug(title);
  return PHOTO_FILES[slug] ? `/team-photos/panel/${slug}.jpg` : null;
}

/** Vertikaler Fokus (background-position-y) des Teamfotos oder null. */
export function teamPhotoFocusY(title: string): string | null {
  return PHOTO_FOCUS_Y[teamSlug(title)] ?? null;
}

/** Optionaler Zoom (background-size) des Teamfotos oder null (=> cover). */
export function teamPhotoZoom(title: string): string | null {
  return PHOTO_ZOOM[teamSlug(title)] ?? null;
}
