/**
 * URL-Bildung für die Swisstennis-Turnier-Endpunkte.
 *
 * Die früheren Servlets unter `comp.swisstennis.ch/advantage/servlet/`
 * verlangen seit dem 19.08.2026 eine angemeldete Session und antworten sonst
 * mit HTTP 403. Dieselben Daten liegen ohne Anmeldung auf der API, die
 * mytennis.ch selbst benutzt. Interclub und Team-Challenge (`/ic/`, `/hic/`)
 * sind nicht betroffen und laufen unverändert über `urls.ts`.
 *
 * Siehe Vault: 30-Datenquellen/SwissTennis.md
 */
const BASE = "https://low-scalability.microservices.swisstennis.ch/tournaments";

/** Turnier mit allen Kategorien (ersetzt TournamentDisplay). */
export function tournamentInfoUrl(tournamentId: number): string {
  return `${BASE}/info?tournamentId=${tournamentId}&lang=de`;
}

/** Kategorie mit Teilnehmerliste (ersetzt PublicDisplayEvent). */
export function categoryInfoUrl(eventId: number): string {
  return `${BASE}/category-info?eventId=${eventId}&lang=de`;
}

/** Tableau als Raster (ersetzt DisplayDraw). */
export function drawUrl(eventId: number): string {
  return `${BASE}/draw?eventId=${eventId}&lang=de`;
}

/** Gruppen mit Ranglisten und Partien (ersetzt DisplayPools). */
export function poolsUrl(eventId: number): string {
  return `${BASE}/pools?eventId=${eventId}&lang=de`;
}

/**
 * Spielplan eines Tages (ersetzt Calendar).
 *
 * Start- und Enddatum müssen TT.MM.JJJJ sein und **denselben Tag** meinen: ein
 * Mehrtagesbereich antwortet mit HTTP 200 und leerer Platzliste, ein ISO-Datum
 * wird still ignoriert.
 */
export function gamePlanUrl(tournamentId: number, swissDate: string): string {
  return `${BASE}/game-plan?tournamentId=${tournamentId}&startDate=${swissDate}&endDate=${swissDate}&lang=de`;
}

/** Öffentliche Turnierseite, für Verlinkungen. */
export function registrationUrl(tournamentId: number): string {
  return `https://www.mytennis.ch/de/turniere/${tournamentId}`;
}
