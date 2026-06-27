/**
 * Validierung externer Links aus Nutzdaten.
 *
 * Nur http(s)-URLs zu erwarteten Domains (MyTennis) werden zugelassen, bevor
 * sie im Frontend als Link verwendet werden.
 */
import { ALLOWED_EXTERNAL_HOSTS } from "../constants.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const MYTENNIS_TOURNAMENT_BASE = "https://www.mytennis.ch/de/turniere";

/** Berechneter Anmeldelink eines Turniers (nie manuell gepflegt). */
export function registrationUrlForId(tournamentId: number): string {
  return `${MYTENNIS_TOURNAMENT_BASE}/${tournamentId}`;
}

/** Liefert die URL zurück, wenn sie sicher zu einer erlaubten Domain führt, sonst "". */
export function safeExternalUrl(rawValue: string | null | undefined): string {
  const value = (rawValue ?? "").trim();
  if (value === "") {
    return "";
  }
  try {
    const url = new URL(value);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return "";
    }
    const host = url.hostname.toLowerCase();
    return ALLOWED_EXTERNAL_HOSTS.includes(host as (typeof ALLOWED_EXTERNAL_HOSTS)[number])
      ? value
      : "";
  } catch {
    return "";
  }
}
