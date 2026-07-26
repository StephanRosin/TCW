/**
 * Datumsbeschriftung der Galerie-Tagesfilter, je Sprache landesüblich statt als
 * naiv zusammengesetzte Vorlage: de „Sa, 18.07.2026", en „Sat, Jul 18, 2026",
 * fr „sam. 18 juil. 2026", it „sab 18 lug 2026". Die Formatierung übernimmt
 * `Intl`, das die Reihenfolge und Trennzeichen je Locale kennt.
 */
const LOCALES: Record<string, string> = {
  de: "de-CH",
  en: "en-GB",
  fr: "fr-CH",
  it: "it-CH",
};

/** "2026-07-18" → lokalisierte Beschriftung mit Wochentag; ungültige Werte unverändert. */
export function formatGalleryDay(day: string, language: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const [, year, month, date] = match;
  const value = new Date(Number(year), Number(month) - 1, Number(date));
  if (Number.isNaN(value.getTime())) return day;
  return new Intl.DateTimeFormat(LOCALES[language] ?? language, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
