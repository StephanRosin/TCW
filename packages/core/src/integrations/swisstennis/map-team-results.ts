/**
 * TeamResults → Gruppenspiele, Rangliste (poolRank-Hybrid) und – sofern die
 * Gruppenphase abgeschlossen ist – die zu ladende Auf-/Abstiegsrunde.
 */
import {
  OWN_CLUB_NAME,
  type BracketRequest,
  type GroupMatch,
  type StandingRow,
  type TeamResultsResponse,
} from "@tcw/shared";
import { asArray, cleanText, clubNameFromIcTeam, toNumber } from "./normalize.js";

interface RawStanding {
  poolRank?: number;
  nbMatch?: number;
  nbWonSet?: number;
  nbLostSet?: number;
  nbSetDiff?: number;
  nbGameDiff?: number;
  icTeam?: unknown;
}

interface RawDate {
  day?: number;
  month?: number;
  hour?: number;
  minute?: number;
}

interface RawEncount {
  encountId?: number;
  nbRound?: number;
  validated?: number | string;
  enDate?: RawDate;
  enPlannedTime?: RawDate;
  icTeamHomeTeam?: unknown;
  icTeamVisitTeam?: unknown;
  homeTmWonMatch?: number;
  visitTmWonMatch?: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatMatchDate(encount: RawEncount): string {
  const date = encount.enDate;
  if (!date || date.day == null || date.month == null) {
    return "–";
  }
  const base = `${pad2(date.day)}.${pad2(date.month + 1)}`;
  const time = encount.enPlannedTime;
  if (time && (time.hour ?? 0) + (time.minute ?? 0) > 0) {
    return `${base} · ${time.hour}:${pad2(time.minute ?? 0)}`;
  }
  return base;
}

function isValidated(value: number | string | undefined): boolean {
  return value === 1 || value === "1";
}

function sortStandings(rows: RawStanding[]): RawStanding[] {
  const ranks = rows.map((row) => toNumber(row.poolRank, 0));
  const allPositive = ranks.every((rank) => rank > 0);
  const allUnique = new Set(ranks).size === ranks.length;
  if (allPositive && allUnique) {
    return [...rows].sort((a, b) => toNumber(a.poolRank) - toNumber(b.poolRank));
  }
  return [...rows].sort((a, b) => {
    const byMatch = toNumber(b.nbMatch) - toNumber(a.nbMatch);
    if (byMatch !== 0) return byMatch;
    const bySet = toNumber(b.nbSetDiff) - toNumber(a.nbSetDiff);
    if (bySet !== 0) return bySet;
    const byGame = toNumber(b.nbGameDiff) - toNumber(a.nbGameDiff);
    if (byGame !== 0) return byGame;
    return clubNameFromIcTeam(a.icTeam).localeCompare(clubNameFromIcTeam(b.icTeam), "de-CH", {
      sensitivity: "base",
    });
  });
}

function toStandingRow(raw: RawStanding, index: number): StandingRow {
  const teamName = clubNameFromIcTeam(raw.icTeam);
  return {
    rank: index + 1,
    teamName,
    points: String(toNumber(raw.nbMatch)),
    sets: `${toNumber(raw.nbWonSet)}-${toNumber(raw.nbLostSet)}`,
    isOwn: teamName === OWN_CLUB_NAME,
  };
}

function toGroupMatch(raw: RawEncount): GroupMatch {
  const home = clubNameFromIcTeam(raw.icTeamHomeTeam);
  const away = clubNameFromIcTeam(raw.icTeamVisitTeam);
  const validated = isValidated(raw.validated);
  return {
    round: String(toNumber(raw.nbRound)),
    date: formatMatchDate(raw),
    home,
    away,
    homeIsOwn: home === OWN_CLUB_NAME,
    awayIsOwn: away === OWN_CLUB_NAME,
    validated,
    result: validated ? `${toNumber(raw.homeTmWonMatch)}:${toNumber(raw.visitTmWonMatch)}` : "",
    encountId: toNumber(raw.encountId),
  };
}

function isThirdLeague(lgName: string): boolean {
  const normalized = lgName.replace(/\s+/g, "").toUpperCase();
  return normalized.includes("3L") || normalized.includes("3.LIGA");
}

function isGroupPhaseComplete(ended: number, encounts: RawEncount[]): boolean {
  if (ended === 1) {
    return true;
  }
  return encounts.length > 0 && encounts.every((encount) => isValidated(encount.validated));
}

function determineBracket(
  standings: StandingRow[],
  ligueId: number,
  lgName: string,
  complete: boolean,
): BracketRequest | null {
  if (!complete || ligueId <= 0) {
    return null;
  }
  const ownIndex = standings.findIndex((row) => row.isOwn);
  if (ownIndex < 0) {
    return null;
  }
  const myRank = ownIndex + 1;
  if (isThirdLeague(lgName)) {
    return null;
  }
  if (myRank <= 2) {
    return { ligueId, promotion: 1, type: "promotion" };
  }
  if (standings.length === 4 && (myRank === 3 || myRank === 4)) {
    return { ligueId, promotion: 0, type: "relegation" };
  }
  return null;
}

export function mapTeamResults(
  payload: unknown,
  _year: string,
  options: { brackets?: boolean } = {},
): TeamResultsResponse {
  const withBrackets = options.brackets ?? true;
  const root = (payload as { I2cm?: Record<string, unknown> }).I2cm ?? {};
  const pool = root.IcPool as
    | { ended?: number; poolName2?: unknown; icTeamPoolSet?: { IcTeamPool?: unknown } }
    | undefined;
  const ligue = root.IcLigue as { ligueId?: number; lgName?: string } | undefined;

  const encounts = asArray<RawEncount>(root.IcEncount as RawEncount | RawEncount[] | undefined);
  const sortedEncounts = [...encounts].sort((a, b) => {
    const byRound = toNumber(a.nbRound, 999) - toNumber(b.nbRound, 999);
    if (byRound !== 0) return byRound;
    return toNumber(a.enDate?.day, 99) - toNumber(b.enDate?.day, 99);
  });
  const matches = sortedEncounts.map(toGroupMatch);

  const rawStandings = asArray<RawStanding>(
    pool?.icTeamPoolSet?.IcTeamPool as RawStanding | RawStanding[] | undefined,
  );
  const standings = sortStandings(rawStandings).map((standing, index) => toStandingRow(standing, index));

  const liga = cleanText(ligue?.lgName ?? "");
  const group = pool?.poolName2 == null ? "" : cleanText(pool.poolName2);
  const complete = isGroupPhaseComplete(toNumber(pool?.ended), sortedEncounts);
  const bracket = withBrackets
    ? determineBracket(standings, toNumber(ligue?.ligueId), liga, complete)
    : null;

  return { title: liga, liga, group, matches, standings, bracket };
}
