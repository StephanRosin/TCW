/**
 * Turnier-Kategorien-Sortierung nach Disziplin, Alter und Klassierung.
 */
import { DISCIPLINE_ORDER, type Discipline } from "../constants.js";

const DISCIPLINE_RANK: Record<string, number> = Object.fromEntries(
  DISCIPLINE_ORDER.map((discipline, index) => [discipline, index]),
);
const UNKNOWN_DISCIPLINE_RANK = DISCIPLINE_ORDER.length;

const DISCIPLINE_PATTERN = /\b(WS|MS|WD|MD|DM)\b/;
const DISCIPLINE_PREFIX_PATTERN = /^(WS|MS|WD|MD|DM)/;

/** Extrahiert die Disziplin aus einem Eventnamen wie "WS R4-R9". */
export function disciplineOf(eventName: string): Discipline | "" {
  const upper = eventName.toUpperCase();
  const token = DISCIPLINE_PATTERN.exec(upper) ?? DISCIPLINE_PREFIX_PATTERN.exec(upper);
  return token ? (token[1] ?? token[0]) as Discipline : "";
}

export function disciplineRank(eventName: string): number {
  const discipline = disciplineOf(eventName);
  return discipline ? DISCIPLINE_RANK[discipline] ?? UNKNOWN_DISCIPLINE_RANK : UNKNOWN_DISCIPLINE_RANK;
}

const AGE_PATTERN = /\b(\d{2})\s*\+/;
const RANKING_PATTERN = /\b([NR])\s*([1-9])\b/g;

/** Alterskategorie aus dem Eventnamen ("35+") als Zahl; Aktiv = 0. */
export function ageRank(eventName: string): number {
  const match = AGE_PATTERN.exec(eventName);
  return match ? Number(match[1]) : 0;
}

const NO_RANKING = 999;

/** Beste (kleinste) Klassierung im Eventnamen als Sortierwert. */
export function rankingRank(eventName: string): number {
  let best = NO_RANKING;
  for (const match of eventName.toUpperCase().matchAll(RANKING_PATTERN)) {
    const letter = match[1];
    const number = Number(match[2]);
    const value = letter === "N" ? number : 4 + number;
    if (value < best) {
      best = value;
    }
  }
  return best;
}

export interface SortableEvent {
  eventName: string;
  sortOrder: number;
}

/** Reihenfolge der Turnierkategorien: Disziplin, dann Alter, dann Klassierung. */
export function compareEvents(a: SortableEvent, b: SortableEvent): number {
  const byDiscipline = disciplineRank(a.eventName) - disciplineRank(b.eventName);
  if (byDiscipline !== 0) return byDiscipline;
  const byAge = ageRank(a.eventName) - ageRank(b.eventName);
  if (byAge !== 0) return byAge;
  const byRanking = rankingRank(a.eventName) - rankingRank(b.eventName);
  if (byRanking !== 0) return byRanking;
  return a.sortOrder - b.sortOrder;
}
