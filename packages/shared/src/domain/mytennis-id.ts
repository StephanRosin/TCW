/**
 * Extrahiert die numerische mytennis.ch-Spieler-ID aus einer Profil-URL.
 * Erlaubt sowohl `/spieler/<id>` (Produktion) als auch `/player/<id>`.
 * Nur mytennis.ch-Hosts; sonst null (kanonische ID nur aus vertrauenswürdiger Quelle).
 */
const MYTENNIS_ID = /^https?:\/\/(?:www\.)?mytennis\.ch\/[^?#]*\/(?:spieler|player)\/(\d+)(?:[/?#]|$)/i;

const PROFILE_BASE = "https://www.mytennis.ch/de/spieler";

export function parseMyTennisId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = MYTENNIS_ID.exec(url.trim());
  return match ? match[1]! : null;
}

/** Baut die mytennis.ch-Profil-URL aus einer numerischen Spieler-ID. Nur rein
 *  numerische IDs ergeben eine URL; sonst null (Umkehr von parseMyTennisId). */
export function myTennisUrlFromId(id: string | number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  const s = String(id).trim();
  if (!/^\d+$/.test(s)) return null;
  return `${PROFILE_BASE}/${s}`;
}
