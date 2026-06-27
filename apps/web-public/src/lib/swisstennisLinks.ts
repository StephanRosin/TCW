/**
 * Erzeugt die öffentlichen Swisstennis-Links für den Verein.
 */
const CLUBRESULT_PUBLIC = "https://comp.swisstennis.ch/ic/servlet/ClubResult?ClubName=1298&Lang=de";

export function clubResultUrl(): string {
  return CLUBRESULT_PUBLIC;
}
