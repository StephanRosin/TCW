/**
 * Übersetzt die (deutsch erzeugten) Rundennamen aus dem Swisstennis-Mapper in
 * die UI-Sprache. Geteilt von TournamentBracket, MatchList und dem Waidcup
 * Order of Play, damit alle Runden-Anzeigen identisch lokalisiert werden.
 */
type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Von unserem Mapper erzeugte (deutsche) Rundennamen → i18n-Key. */
const ROUND_KEY: Record<string, string> = {
  Final: "round.final",
  Halbfinal: "round.semifinal",
  Viertelfinal: "round.quarterfinal",
  Achtelfinal: "round.round16",
  "1/16 Final": "round.round32",
};

/**
 * Bekannte Runden über ihren i18n-Key, „Runde N" mit übersetztem Wort + Nummer;
 * alles andere (z. B. Round-robin-Gruppennamen) bleibt unverändert.
 */
export function translateRound(roundName: string, t: Translate): string {
  const key = ROUND_KEY[roundName];
  if (key) return t(key);
  const numbered = /^Runde (\d+)$/.exec(roundName);
  if (numbered) return t("round.round", { number: numbered[1]! });
  return roundName;
}
