/**
 * Erzeugt die öffentlichen Swisstennis-/MyTennis-Links für Begegnungen.
 */
const INTERCLUB_BASE = "https://www.mytennis.ch/de/interclub";
const CLUBRESULT_PUBLIC = "https://comp.swisstennis.ch/ic/servlet/ClubResult?ClubName=1298&Lang=de";

export function encounterUrl(encountId: number, year: string, isPlayoff: boolean): string {
  const path = isPlayoff ? "tableau-ergebnisse" : "begegnungsergebnisse";
  return `${INTERCLUB_BASE}/${path}?encounterId=${encountId}&year=${encodeURIComponent(year)}`;
}

export function clubResultUrl(): string {
  return CLUBRESULT_PUBLIC;
}
