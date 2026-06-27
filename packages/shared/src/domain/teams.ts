/**
 * Fachliche Sortierregeln für Teams und Spieler.
 *
 * Reine Funktionen ohne Seiteneffekte, damit sie isoliert testbar sind und
 * im Backend (Listenaufbau) wie im Frontend (Anzeige) identisch greifen.
 */
import { CAPTAIN_STATUS, type CaptainStatus, type Gender } from "../constants.js";
import { rankingOrder } from "./ranking.js";

/** Standard-Ligaordnung: NLA besser als NLB … 3. Liga. */
const STANDARD_LEAGUE_RANK: Record<string, number> = {
  NLA: 0,
  NLB: 1,
  NLC: 2,
  "1.LIGA": 3,
  "2.LIGA": 4,
  "3.LIGA": 5,
};
const UNKNOWN_LEAGUE_RANK = 99;

function normalizeLeagueKey(liga: string): string {
  return liga.replace(/\s+/g, "").toUpperCase();
}

/** Sortierrang einer Liga in Standardordnung (NLA zuerst). */
export function leagueRank(liga: string): number {
  return STANDARD_LEAGUE_RANK[normalizeLeagueKey(liga)] ?? UNKNOWN_LEAGUE_RANK;
}

const ACTIVE_CATEGORY = "AKTIV";
const UNKNOWN_CATEGORY_RANK = 999;

/** Sortierrang einer Alterskategorie: Aktiv zuerst, dann 30+, 35+, … */
export function categoryRank(category: string): number {
  const normalized = category.trim().toUpperCase();
  if (normalized === ACTIVE_CATEGORY) {
    return 0;
  }
  const leadingNumber = normalized.match(/^\d+/);
  return leadingNumber ? Number(leadingNumber[0]) : UNKNOWN_CATEGORY_RANK;
}

export function genderRank(gender: Gender | string): number {
  if (gender === "Damen") return 0;
  if (gender === "Herren") return 1;
  return 9;
}

export interface SortableTeam {
  gender: string;
  category: string;
  liga: string;
}

/** Vergleicht Teams innerhalb eines Geschlechts: Liga, dann Kategorie. */
export function compareTeamsWithinGender(a: SortableTeam, b: SortableTeam): number {
  const byLeague = leagueRank(a.liga) - leagueRank(b.liga);
  if (byLeague !== 0) return byLeague;
  const byCategory = categoryRank(a.category) - categoryRank(b.category);
  if (byCategory !== 0) return byCategory;
  const byCategoryName = a.category.localeCompare(b.category, "de");
  if (byCategoryName !== 0) return byCategoryName;
  return a.liga.localeCompare(b.liga, "de");
}

const CAPTAIN_SORT_RANK: Record<number, number> = {
  [CAPTAIN_STATUS.captain]: 0,
  [CAPTAIN_STATUS.viceCaptain]: 1,
  [CAPTAIN_STATUS.none]: 2,
};

export interface SortablePlayer {
  captainStatus: CaptainStatus;
  klassierung: string;
  name: string;
}

/** Spielerreihenfolge: Captain, Stellvertretung, dann Klassierung und Name. */
export function comparePlayers(a: SortablePlayer, b: SortablePlayer): number {
  const byCaptain =
    (CAPTAIN_SORT_RANK[a.captainStatus] ?? 3) - (CAPTAIN_SORT_RANK[b.captainStatus] ?? 3);
  if (byCaptain !== 0) return byCaptain;

  const [groupA, valueA] = rankingOrder(a.klassierung);
  const [groupB, valueB] = rankingOrder(b.klassierung);
  if (groupA !== groupB) return groupA - groupB;
  if (valueA !== valueB) return valueA - valueB;

  return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
}
