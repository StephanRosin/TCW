/**
 * Kontextuelle Übersetzung bekannter Tennis-/Liga-Begriffe innerhalb sonst
 * nicht übersetzter Datenbank-/Swisstennis-Texte (z. B. in Teamnamen).
 *
 * Datenbankinhalte werden nicht pauschal übersetzt; nur diese klar definierten
 * Begriffe werden wortweise ersetzt.
 */
export const KNOWN_TEXT_REPLACEMENTS: ReadonlyArray<{ pattern: RegExp; key: string }> = [
  { pattern: /\bNLA\b/g, key: "leagues.nla" },
  { pattern: /\bNLB\b/g, key: "leagues.nlb" },
  { pattern: /\bNLC\b/g, key: "leagues.nlc" },
  { pattern: /\bDamen\b/g, key: "gender.women" },
  { pattern: /\bHerren\b/g, key: "gender.men" },
  { pattern: /\bAufstieg\b/g, key: "results.promotion" },
  { pattern: /\bAbstieg\b/g, key: "results.relegation" },
  { pattern: /\bGruppe\b/g, key: "teams.groupWord" },
];

const HOME_MARKER_REMARK_DE = "* bezeichnet die Mannschaft, die zu Hause spielt.";
const HOME_MARKER_REMARK_KEY = "results.homeMarkerRemark";

export type TranslateFn = (key: string) => string;

/**
 * Übersetzt bekannte UI-Begriffe in einem Datenwert. `translate` liefert den
 * lokalisierten Text zu einem i18n-Schlüssel.
 */
export function translateKnownText(value: string, translate: TranslateFn): string {
  if (value === HOME_MARKER_REMARK_DE) {
    return translate(HOME_MARKER_REMARK_KEY);
  }
  let result = value;
  for (const { pattern, key } of KNOWN_TEXT_REPLACEMENTS) {
    result = result.replace(pattern, translate(key));
  }
  return result;
}
