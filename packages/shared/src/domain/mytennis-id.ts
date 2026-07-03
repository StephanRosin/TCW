/**
 * Extrahiert die numerische mytennis.ch-Spieler-ID aus einer Profil-URL.
 * Erlaubt sowohl `/spieler/<id>` (Produktion) als auch `/player/<id>`.
 * Nur mytennis.ch-Hosts; sonst null (kanonische ID nur aus vertrauenswürdiger Quelle).
 */
const MYTENNIS_ID = /^https?:\/\/(?:www\.)?mytennis\.ch\/[^?#]*\/(?:spieler|player)\/(\d+)(?:[/?#]|$)/i;

export function parseMyTennisId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = MYTENNIS_ID.exec(url.trim());
  return match ? match[1]! : null;
}
