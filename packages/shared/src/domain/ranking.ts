/**
 * Klassierungs-Ordnung (Swiss Tennis): N1 ist am besten, dann N2 … R1 … R9.
 *
 * Die Ordnung wird als Tupel [Gruppe, Zahl] ausgedrückt, damit sie direkt als
 * stabiler Sortierschlüssel dient. Kleinere Werte = bessere Klassierung.
 */
export type RankingOrder = readonly [group: number, value: number];

const NATIONAL_PATTERN = /^N\d+$/;
const REGIONAL_PATTERN = /^R\d+$/;

const EMPTY_ORDER: RankingOrder = [9, 999];
const UNKNOWN_ORDER: RankingOrder = [8, 999];

/** Liefert den Sortierschlüssel einer Klassierung wie "N4" oder "R6". */
export function rankingOrder(value: string | null | undefined): RankingOrder {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "") {
    return EMPTY_ORDER;
  }
  if (NATIONAL_PATTERN.test(normalized)) {
    return [0, Number(normalized.slice(1))];
  }
  if (REGIONAL_PATTERN.test(normalized)) {
    return [1, Number(normalized.slice(1))];
  }
  return UNKNOWN_ORDER;
}

/** Vergleicht zwei Klassierungen aufsteigend (beste zuerst). */
export function compareByRanking(a: string, b: string): number {
  const [groupA, valueA] = rankingOrder(a);
  const [groupB, valueB] = rankingOrder(b);
  if (groupA !== groupB) {
    return groupA - groupB;
  }
  return valueA - valueB;
}

export type RankingTrend = "up" | "down" | "flat";

/** Bestimmt, ob eine Klassierungsänderung eine Verbesserung oder Verschlechterung ist. */
export function rankingTrend(oldValue: string, newValue: string): RankingTrend {
  const [oldGroup, oldNumber] = rankingOrder(oldValue);
  const [newGroup, newNumber] = rankingOrder(newValue);
  if (newGroup !== oldGroup) {
    return newGroup < oldGroup ? "up" : "down";
  }
  if (newNumber !== oldNumber) {
    return newNumber < oldNumber ? "up" : "down";
  }
  return "flat";
}

const VALID_RANKING_TOKEN = /^(NC|N[1-4]|R[1-9])$/;

/**
 * Prüft, ob ein Token eine echte Klassierung ist. Verhindert, dass
 * Gesetztennummern wie "(1)" fälschlich als Klassierung erscheinen.
 */
export function isRankingToken(token: string): boolean {
  return VALID_RANKING_TOKEN.test(token.trim().toUpperCase());
}
