/**
 * URL-Bildung für die Swisstennis-Turnier-Endpunkte (advantage-Servlet).
 */
const BASE = "https://comp.swisstennis.ch/advantage/servlet";

export function tournamentDisplayUrl(tournamentId: number): string {
  return `${BASE}/TournamentDisplay?tournament=Id${tournamentId}&Lang=de&outputFormat=JSON`;
}

export function publicDisplayEventUrl(eventId: number): string {
  return `${BASE}/PublicDisplayEvent?eventId=${eventId}&Lang=de&outputFormat=JSON`;
}

export function displayDrawUrl(eventId: number): string {
  return `${BASE}/DisplayDraw?eventId=${eventId}&Lang=de&outputFormat=JSON`;
}

export function displayPoolsUrl(eventId: number): string {
  return `${BASE}/DisplayPools?eventId=${eventId}&Lang=de&outputFormat=JSON`;
}

/** Berechneter Anmeldelink eines Turniers (nie manuell gepflegt). */
export function registrationUrl(tournamentId: number): string {
  return `https://www.mytennis.ch/de/turniere/${tournamentId}`;
}
