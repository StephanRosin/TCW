/**
 * Sieger-Ermittlung und -Beschriftung, geteilt von Tableau und Round-robin.
 *
 * Die Beschriftung richtet sich nach der Disziplin, weil „Sieger" bei den
 * Frauenkonkurrenzen falsch wäre und Mixed beide Geschlechter umfasst.
 */
import type { Discipline, PoolStanding } from "@tcw/shared";

// Mixed (DM) wird gesondert behandelt und gehört deshalb nicht in diese Menge.
const WOMEN = new Set<Discipline>(["WS", "WD"]);

/** i18n-Schlüssel der Sieger-Beschriftung für eine Disziplin. */
export function championLabelKey(discipline: Discipline | "" | undefined): string {
  if (discipline === "DM") return "tournaments.championMixed";
  if (discipline && WOMEN.has(discipline)) return "tournaments.championFemale";
  return "tournaments.champion";
}

/**
 * Sieger einer Round-robin-Konkurrenz: das Team auf Rang 1. Bewusst nur, wenn
 * das Ergebnis auch feststeht – also genau eine Gruppe (sonst gibt es keinen
 * einzelnen Sieger), jeder hat gegen jeden gespielt und Rang 1 ist eindeutig.
 * Sonst `null`, damit während des Turniers kein voreiliger Sieger erscheint.
 */
export function poolChampionNames(pools: PoolStanding[]): string[] | null {
  const pool = pools.length === 1 ? pools[0] : undefined;
  if (!pool || pool.rows.length < 2) return null;
  const playedByEveryone = pool.rows.length - 1;
  if (!pool.rows.every((row) => row.matches === playedByEveryone)) return null;
  // Ohne gelieferten Rang gilt – wie in der Tabelle – die Reihenfolge.
  const leaders = pool.rows.filter((row, index) => (row.rank || index + 1) === 1);
  const leader = leaders.length === 1 ? leaders[0] : undefined;
  return leader && leader.names.length > 0 ? leader.names : null;
}
