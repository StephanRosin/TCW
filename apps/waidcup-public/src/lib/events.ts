/**
 * Waidcup-spezifische Event-Darstellung: das Aktiv-Kürzel "A" ist in den
 * Kategorienamen redundant und wird überall entfernt; Kategorien werden nach
 * Stärkeklasse (R1/R5 vor R5/R9), Damen vor Herren, Doppel zuletzt sortiert.
 */
import { disciplineOf, rankingRank } from "@tcw/shared";

/** "MS A R1/R5" → "MS R1/R5" */
export function displayEventName(name: string): string {
  return name.replace(/\sA(?=\s|$)/g, "");
}

const DOUBLE_DISCIPLINES: ReadonlySet<string> = new Set(["WD", "MD", "DM"]);
const GENDER_RANK: Record<string, number> = { WS: 0, WD: 0, MS: 1, MD: 1, DM: 2 };
const UNKNOWN_GENDER_RANK = 3;

export function compareWaidcupEvents(a: string, b: string): number {
  const doublesFirst =
    Number(DOUBLE_DISCIPLINES.has(disciplineOf(a))) - Number(DOUBLE_DISCIPLINES.has(disciplineOf(b)));
  if (doublesFirst !== 0) return doublesFirst;
  const byRanking = rankingRank(a) - rankingRank(b);
  if (byRanking !== 0) return byRanking;
  const byGender =
    (GENDER_RANK[disciplineOf(a)] ?? UNKNOWN_GENDER_RANK) -
    (GENDER_RANK[disciplineOf(b)] ?? UNKNOWN_GENDER_RANK);
  if (byGender !== 0) return byGender;
  return a.localeCompare(b, "de");
}
