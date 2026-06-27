/**
 * Übersetzt Trainingswochentage innerhalb frei gepflegter Felder
 * (z. B. "Montag / Mittwoch") und behält die Trennzeichen bei.
 */
const DAY_KEYS: Record<string, string> = {
  montag: "training.days.monday",
  dienstag: "training.days.tuesday",
  mittwoch: "training.days.wednesday",
  donnerstag: "training.days.thursday",
  freitag: "training.days.friday",
  samstag: "training.days.saturday",
  sonntag: "training.days.sunday",
};

const SEPARATOR = /(\s*(?:\/|,|\+|und|oder)\s*)/i;

export function translateTrainingDays(value: string, translate: (key: string) => string): string {
  return value
    .split(SEPARATOR)
    .map((part) => {
      const key = DAY_KEYS[part.trim().toLowerCase()];
      return key ? translate(key) : part;
    })
    .join("");
}
