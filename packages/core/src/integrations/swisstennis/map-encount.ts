/**
 * EncountResults/TableauResults → Begegnungsdetail mit Einzel- und
 * Doppeltabellen, Klassierungen, Gewinner- und Walkover-Erkennung.
 */
import {
  isRankingToken,
  type EncountDetailResponse,
  type EncountMatch,
  type ResultType,
} from "@tcw/shared";
import { asArray, cleanText, toNumber } from "./normalize.js";

interface RawPlayer {
  name?: string;
  class?: string;
}
interface RawSideScore {
  wo?: number;
  sg1?: number;
  sg2?: number;
  sg3?: number;
}
interface RawMatch {
  name?: number | string;
  Scores?: { Home?: RawSideScore; Visit?: RawSideScore };
  Players?: { Home?: { Player?: RawPlayer | RawPlayer[] }; Visit?: { Player?: RawPlayer | RawPlayer[] } };
}

const NO_SET = -1;
const SET_KEYS: ReadonlyArray<keyof RawSideScore> = ["sg1", "sg2", "sg3"];

function formatPlayer(player: RawPlayer): string {
  const name = cleanText(player.name ?? "–");
  const klass = cleanText(player.class ?? "");
  return klass && isRankingToken(klass) ? `${name} (${klass})` : name;
}

function sideNames(side: { Player?: RawPlayer | RawPlayer[] } | undefined): string[] {
  return asArray<RawPlayer>(side?.Player).map(formatPlayer);
}

function isWalkover(home: RawSideScore, visit: RawSideScore): boolean {
  return home.wo === 1 || visit.wo === 1;
}

/** Gespielte Sätze als "h:v"-Liste (ungespielte Sätze mit -1 werden übersprungen). */
function playedSets(home: RawSideScore, visit: RawSideScore): string {
  const sets: string[] = [];
  let hasPlayed = false;
  for (const key of SET_KEYS) {
    const homeGames = toNumber(home[key], NO_SET);
    const visitGames = toNumber(visit[key], NO_SET);
    if (homeGames < 0 || visitGames < 0) {
      continue;
    }
    if (homeGames > 0 || visitGames > 0) {
      hasPlayed = true;
    }
    sets.push(`${homeGames}:${visitGames}`);
  }
  return hasPlayed ? sets.join(" ") : "";
}

function formatScore(home: RawSideScore, visit: RawSideScore): string {
  const sets = playedSets(home, visit);
  // Bei Aufgabe/Walkover zeigt Swisstennis das Teilergebnis plus "w.o." an.
  if (isWalkover(home, visit)) {
    return sets ? `${sets} w.o.` : "w.o.";
  }
  return sets || "–";
}

function determineHomeWinner(home: RawSideScore, visit: RawSideScore): boolean | null {
  // wo=1 markiert die Gewinnerseite (die Begegnung wird ihr per Walkover/Aufgabe
  // zugesprochen) – nicht die Seite, die aufgegeben hat.
  if (home.wo === 1) return true;
  if (visit.wo === 1) return false;
  let homeSets = 0;
  let visitSets = 0;
  for (const key of SET_KEYS) {
    const homeGames = toNumber(home[key], NO_SET);
    const visitGames = toNumber(visit[key], NO_SET);
    if (homeGames < 0 || visitGames < 0) continue;
    if (homeGames > visitGames) homeSets += 1;
    else if (visitGames > homeGames) visitSets += 1;
  }
  if (homeSets === 0 && visitSets === 0) {
    return null;
  }
  return homeSets >= 2 ? true : visitSets >= 2 ? false : null;
}

function toEncountMatch(raw: RawMatch): EncountMatch {
  const home = raw.Scores?.Home ?? {};
  const visit = raw.Scores?.Visit ?? {};
  const score = formatScore(home, visit);
  return {
    position: String(raw.name ?? ""),
    homeNames: sideNames(raw.Players?.Home),
    awayNames: sideNames(raw.Players?.Visit),
    score,
    homeWon: score === "–" ? null : determineHomeWinner(home, visit),
    walkover: isWalkover(home, visit),
  };
}

interface RawEncountInfo {
  Played?: { Date?: { day?: number; month?: number; year?: number } };
  Home?: { Team?: { name?: string; clubNb?: number }; EncountResult?: { matches?: number } };
  Visit?: { Team?: { name?: string }; EncountResult?: { matches?: number } };
  Ligue?: { lgDEName?: string; lgShortName?: string };
  groupNb?: string;
}

function formatEncountDate(date: RawEncountInfo["Played"]): string {
  const value = date?.Date;
  if (!value || value.day == null || value.month == null || value.year == null) {
    return "";
  }
  return `${value.day}.${value.month + 1}.${value.year}`;
}

function buildSwisstennisUrl(encountId: number, year: string, type: ResultType): string {
  const path = type === "tableau" ? "tableau-ergebnisse" : "begegnungsergebnisse";
  return `https://www.mytennis.ch/de/interclub/${path}?encounterId=${encountId}&year=${encodeURIComponent(year)}`;
}

export function mapEncountDetail(
  payload: unknown,
  encountId: number,
  year: string,
  resultType: ResultType,
): EncountDetailResponse {
  const encount =
    (payload as { I2cm?: { EncountResults?: { Encount?: Record<string, unknown> } } }).I2cm
      ?.EncountResults?.Encount ?? {};
  const info = (encount.EncountInfo ?? {}) as RawEncountInfo;

  const singles = asArray<RawMatch>(
    (encount.Singles as { Match?: RawMatch | RawMatch[] } | undefined)?.Match,
  ).map(toEncountMatch);
  const doubles = asArray<RawMatch>(
    (encount.Doubles as { Match?: RawMatch | RawMatch[] } | undefined)?.Match,
  ).map(toEncountMatch);

  return {
    homeTeam: cleanText(info.Home?.Team?.name ?? "–"),
    awayTeam: cleanText(info.Visit?.Team?.name ?? "–"),
    homeClubNb: toNumber(info.Home?.Team?.clubNb),
    totalResult: `${toNumber(info.Home?.EncountResult?.matches)}:${toNumber(info.Visit?.EncountResult?.matches)}`,
    date: formatEncountDate(info.Played),
    liga: cleanText(info.Ligue?.lgDEName ?? info.Ligue?.lgShortName ?? ""),
    group: cleanText(info.groupNb ?? ""),
    singles,
    doubles,
    swisstennisUrl: buildSwisstennisUrl(encountId, year, resultType),
    resultType,
    year,
  };
}
