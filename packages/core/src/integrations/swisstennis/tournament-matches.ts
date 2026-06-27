/**
 * Turnier-Matches aus DisplayDraw (Tableau) und DisplayPools (Round-robin).
 *
 * Es werden nur Partien übernommen, bei denen beide Seiten feststehen
 * (keine Platzhalter, kein "bye"/"noch offen").
 */
import {
  isRankingToken,
  type PoolStanding,
  type TournamentBracket,
  type TournamentBracketMatch,
  type TournamentBracketRound,
  type TournamentMatchStatus,
} from "@tcw/shared";
import { asArray, cleanText, toNumber } from "./normalize.js";

export interface MatchRecord {
  matchKey: string;
  eventId: number;
  eventName: string;
  mode: string;
  poolName: string;
  roundName: string;
  scheduledDate: string;
  scheduledTime: string;
  court: string;
  player1Name: string;
  player1Name2: string;
  player2Name: string;
  player2Name2: string;
  result: string;
  status: TournamentMatchStatus;
  winnerSide: number;
}

const BYE = /^bye$/i;
const PENDING = /^noch offen$/i;

function isKnownPlayer(name: string): boolean {
  const value = cleanText(name);
  return value !== "" && !BYE.test(value) && !PENDING.test(value);
}

function matchStatus(result: string): TournamentMatchStatus {
  return cleanText(result) !== "" ? "played" : "open";
}

/**
 * Ermittelt die Gewinnerseite aus dem Satzresultat (z. B. "5/7 6/2 10/3" oder
 * "6:1 6:1"). Robust für Einzel und Doppel, unabhängig vom Modus. 0 = unklar.
 */
export function winnerSideFromScore(result: string): number {
  let side1Sets = 0;
  let side2Sets = 0;
  for (const set of cleanText(result).split(/\s+/)) {
    const match = set.match(/^(\d+)[/:](\d+)$/);
    if (!match) continue;
    const games1 = Number(match[1]);
    const games2 = Number(match[2]);
    if (games1 > games2) side1Sets += 1;
    else if (games2 > games1) side2Sets += 1;
  }
  if (side1Sets === side2Sets) return 0;
  return side1Sets > side2Sets ? 1 : 2;
}

function formatPlayer(name: string, ranking: string): string {
  const cleanedName = cleanText(name);
  return ranking && isRankingToken(ranking) ? `${cleanedName} (${ranking})` : cleanedName;
}

// --------------------------------------------------------------------------
// Round-robin (DisplayPools)
// --------------------------------------------------------------------------

interface RawRrPlayer {
  plyFirstName?: string;
  plyName?: string;
  plyFirstName2?: string;
  plyName2?: string;
  plyRankingComment?: string;
  plyRankingComment2?: string;
}
interface RawRrDate {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
}
interface RawRrMatch {
  rRMatchId?: number;
  rrmComment?: string;
  rrmDate?: RawRrDate;
  rrmPlayer1WO?: number;
  rrmPlayer2WO?: number;
  ioCourt?: { IoCourt?: { crtName?: string } };
  ioPlayerRrmIdPlayer2?: { IoPlayer?: RawRrPlayer };
  [key: string]: unknown;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function rrName(player: RawRrPlayer | undefined, isDouble: boolean): { name: string; name2: string } {
  if (!player) return { name: "", name2: "" };
  const name = formatPlayer(
    `${cleanText(player.plyFirstName ?? "")} ${cleanText(player.plyName ?? "")}`,
    cleanText(player.plyRankingComment ?? ""),
  );
  const name2 =
    isDouble && (player.plyName2 || player.plyFirstName2)
      ? formatPlayer(
          `${cleanText(player.plyFirstName2 ?? "")} ${cleanText(player.plyName2 ?? "")}`,
          cleanText(player.plyRankingComment2 ?? ""),
        )
      : "";
  return { name, name2 };
}

function rrSchedule(date: RawRrDate | undefined): { date: string; time: string } {
  if (!date || date.year == null) return { date: "", time: "" };
  return {
    date: `${date.year}-${pad2((date.month ?? 0) + 1)}-${pad2(date.day ?? 1)}`,
    time: date.hour == null ? "" : `${pad2(date.hour)}:${pad2(date.minute ?? 0)}`,
  };
}

function rrResult(match: RawRrMatch): string {
  const comment = cleanText(match.rrmComment ?? "").replace(/\//g, ":");
  if (comment && comment.toUpperCase() !== "WO") {
    return comment;
  }
  if (comment.toUpperCase() === "WO") {
    return "w.o.";
  }
  const sets: string[] = [];
  for (let set = 1; set <= 3; set += 1) {
    const home = toNumber(match[`rrmPlayer1Set${set}Games`], -1);
    const visit = toNumber(match[`rrmPlayer2Set${set}Games`], -1);
    if (home >= 0 && visit >= 0) {
      sets.push(`${home}:${visit}`);
    }
  }
  return sets.join(" ");
}

function rrWinnerSide(match: RawRrMatch, result: string): number {
  if (match.rrmPlayer1WO === 1) return 2;
  if (match.rrmPlayer2WO === 1) return 1;
  let player1Sets = 0;
  let player2Sets = 0;
  for (let set = 1; set <= 3; set += 1) {
    const home = toNumber(match[`rrmPlayer1Set${set}Games`], -1);
    const visit = toNumber(match[`rrmPlayer2Set${set}Games`], -1);
    if (home < 0 || visit < 0) continue;
    if (home > visit) player1Sets += 1;
    else if (visit > home) player2Sets += 1;
  }
  if (player1Sets !== player2Sets && (player1Sets > 0 || player2Sets > 0)) {
    return player1Sets > player2Sets ? 1 : 2;
  }
  // Fallback: aus dem (oft als Kommentar gelieferten) Satzresultat ableiten.
  return winnerSideFromScore(result);
}

function mapRoundRobinMatches(payload: unknown, eventName: string, eventId: number, isDouble: boolean): MatchRecord[] {
  const event = (payload as { Iotto?: { IoEvent?: { ioPoolSet?: { IoPool?: unknown } } } }).Iotto?.IoEvent;
  const pools = asArray<{ polName?: string; ioPlayerPoolSet?: { IoPlayerPool?: unknown } }>(
    event?.ioPoolSet?.IoPool as never,
  );
  const records: MatchRecord[] = [];

  for (const pool of pools) {
    const poolName = cleanText(pool.polName ?? "");
    const playerPools = asArray<{ ioPlayer?: { IoPlayer?: RawRrPlayer } }>(
      pool.ioPlayerPoolSet?.IoPlayerPool as never,
    );
    for (const playerPool of playerPools) {
      const player1 = playerPool.ioPlayer?.IoPlayer;
      const player1Names = rrName(player1, isDouble);
      const matches = asArray<RawRrMatch>(
        (player1 as { ioRRMatchRrmIdPlayer1Set?: { IoRRMatch?: unknown } } | undefined)
          ?.ioRRMatchRrmIdPlayer1Set?.IoRRMatch as never,
      );
      for (const match of matches) {
        const player2Names = rrName(match.ioPlayerRrmIdPlayer2?.IoPlayer, isDouble);
        if (!isKnownPlayer(player1Names.name) || !isKnownPlayer(player2Names.name)) {
          continue;
        }
        const result = rrResult(match);
        const schedule = rrSchedule(match.rrmDate);
        records.push({
          matchKey: `rr:${eventId}:${match.rRMatchId ?? `${player1Names.name}:${player2Names.name}`}`,
          eventId,
          eventName,
          mode: "Round-robin",
          poolName,
          roundName: poolName,
          scheduledDate: schedule.date,
          scheduledTime: schedule.time,
          court: cleanText(match.ioCourt?.IoCourt?.crtName ?? ""),
          player1Name: player1Names.name,
          player1Name2: player1Names.name2,
          player2Name: player2Names.name,
          player2Name2: player2Names.name2,
          result,
          status: matchStatus(result),
          winnerSide: rrWinnerSide(match, result),
        });
      }
    }
  }
  return records;
}

// --------------------------------------------------------------------------
// Draw (DisplayDraw)
// --------------------------------------------------------------------------

interface RawDrawName {
  content?: string;
  name2?: string;
}
interface RawDrawSlot {
  alevel?: number;
  rposition?: number;
  name?: RawDrawName;
  court?: string | { content?: string };
  result?: { content?: string };
}

const ROUND_NAMES: Record<number, string> = {
  0: "Final",
  1: "Halbfinal",
  2: "Viertelfinal",
  3: "Achtelfinal",
  4: "1/16 Final",
};

function roundName(level: number): string {
  return ROUND_NAMES[level] ?? `Runde ${level}`;
}

function rankingPrefixTokens(content: string): { name: string; ranking: string } {
  // Entfernt alle führenden "(…)"-Gruppen (Setzposition und/oder Klassierung)
  // und behält die erste echte Klassierung, z. B. "(1) (R4/R3) Rosin Stephan".
  let rest = cleanText(content);
  let ranking = "";
  const leadingGroup = /^\(([^)]*)\)\s*/;
  let match = rest.match(leadingGroup);
  while (match) {
    const token = (match[1] ?? "")
      .split("/")
      .map((part) => part.trim())
      .find((part) => isRankingToken(part));
    if (token && !ranking) {
      ranking = token;
    }
    rest = rest.slice(match[0].length);
    match = rest.match(leadingGroup);
  }
  return { name: cleanText(rest), ranking };
}

function splitDrawSide(row: RawDrawSlot | undefined): { name: string; name2: string } {
  if (!row?.name) return { name: "", name2: "" };
  const parsed = rankingPrefixTokens(cleanText(row.name.content ?? ""));
  return {
    name: formatPlayer(parsed.name, parsed.ranking),
    name2: cleanText(row.name.name2 ?? "").replace(/^\/\s*/, ""),
  };
}

function parseCourt(court: RawDrawSlot["court"]): { date: string; time: string; court: string } {
  const raw = typeof court === "string" ? court : cleanText(court?.content ?? "");
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?:\s+\((.+?)\))?/);
  if (!match) {
    return { date: "", time: "", court: raw };
  }
  return {
    date: `20${match[3]}-${match[2]}-${match[1]}`,
    time: `${match[4]}:${match[5]}`,
    court: cleanText(match[6] ?? ""),
  };
}

function mapDrawMatches(payload: unknown, eventName: string, eventId: number): MatchRecord[] {
  const drawRows = asArray<RawDrawSlot>(
    (payload as { Iotto?: { drawtable?: { drawbody?: { draw?: unknown } } } }).Iotto?.drawtable
      ?.drawbody?.draw as never,
  );
  const byPosition = new Map<string, RawDrawSlot>();
  for (const row of drawRows) {
    byPosition.set(`${toNumber(row.alevel)}:${toNumber(row.rposition)}`, row);
  }

  const records: MatchRecord[] = [];
  for (const slot of drawRows) {
    if (!slot.court && !slot.result?.content) {
      continue;
    }
    const level = toNumber(slot.alevel);
    const position = toNumber(slot.rposition);
    const side1 = byPosition.get(`${level + 1}:${position * 2}`);
    const side2 = byPosition.get(`${level + 1}:${position * 2 + 1}`);
    const names1 = splitDrawSide(side1);
    const names2 = splitDrawSide(side2);
    if (!isKnownPlayer(names1.name) || !isKnownPlayer(names2.name)) {
      continue;
    }
    // Swisstennis trennt Satzergebnisse im Tableau mit "/" – einheitlich auf ":".
    const result = cleanText(slot.result?.content ?? "").replace(/\//g, ":");
    const schedule = parseCourt(slot.court);
    const winnerName = splitDrawSide(slot).name;
    const winnerSide =
      winnerSideFromScore(result) ||
      (winnerName === names1.name ? 1 : winnerName === names2.name ? 2 : 0);
    records.push({
      matchKey: `draw:${eventId}:${level}:${position}`,
      eventId,
      eventName,
      mode: "Draw",
      poolName: "",
      roundName: roundName(level),
      scheduledDate: schedule.date,
      scheduledTime: schedule.time,
      court: schedule.court,
      player1Name: names1.name,
      player1Name2: names1.name2,
      player2Name: names2.name,
      player2Name2: names2.name2,
      result,
      status: matchStatus(result),
      winnerSide,
    });
  }
  return records;
}

/** Wählt anhand des Event-Modus den passenden Match-Mapper. */
export function mapEventMatches(
  payload: unknown,
  mode: string,
  eventName: string,
  eventId: number,
  isDouble: boolean,
): MatchRecord[] {
  if (mode === "Draw") {
    return mapDrawMatches(payload, eventName, eventId);
  }
  if (mode === "Round-robin") {
    return mapRoundRobinMatches(payload, eventName, eventId, isDouble);
  }
  return [];
}

// --------------------------------------------------------------------------
// Round-robin-Tabelle (DisplayPools)
// --------------------------------------------------------------------------

interface RawPoolPlayer {
  plpRank?: number;
  plpNbMatches?: number;
  plpNbVictories?: number;
  plpNbWonsets?: number;
  plpNbLostSets?: number;
  plpNbWonGames?: number;
  plpNbLostGames?: number;
  ioPlayer?: { IoPlayer?: RawRrPlayer };
}

/** Liefert die offizielle Pool-Tabelle (Rang, Siege, Sätze, Games) je Pool. */
export function mapPoolStandings(payload: unknown, isDouble: boolean): PoolStanding[] {
  const event = (payload as { Iotto?: { IoEvent?: { ioPoolSet?: { IoPool?: unknown } } } }).Iotto?.IoEvent;
  const pools = asArray<{ polName?: string; ioPlayerPoolSet?: { IoPlayerPool?: unknown } }>(
    event?.ioPoolSet?.IoPool as never,
  );
  return pools
    .map((pool) => {
      const rows = asArray<RawPoolPlayer>(pool.ioPlayerPoolSet?.IoPlayerPool as never)
        .map((entry) => {
          const { name, name2 } = rrName(entry.ioPlayer?.IoPlayer, isDouble);
          return {
            rank: toNumber(entry.plpRank, 0),
            names: [name, name2].filter((value) => value !== ""),
            matches: toNumber(entry.plpNbMatches),
            victories: toNumber(entry.plpNbVictories),
            sets: `${toNumber(entry.plpNbWonsets)}:${toNumber(entry.plpNbLostSets)}`,
            games: `${toNumber(entry.plpNbWonGames)}:${toNumber(entry.plpNbLostGames)}`,
          };
        })
        .filter((row) => row.names.length > 0)
        .sort((a, b) => a.rank - b.rank);
      return { poolName: cleanText(pool.polName ?? ""), rows };
    })
    .filter((pool) => pool.rows.length > 0);
}

// --------------------------------------------------------------------------
// Tableau-Baum (DisplayDraw)
// --------------------------------------------------------------------------

/**
 * Baut den vollständigen Tableau-Baum (von der ersten Runde bis zum Final),
 * auch wenn spätere Runden noch nicht ausgelost/gespielt sind (leere Seiten).
 */
export function mapDrawBracket(payload: unknown): TournamentBracket | null {
  const drawRows = asArray<RawDrawSlot>(
    (payload as { Iotto?: { drawtable?: { drawbody?: { draw?: unknown } } } }).Iotto?.drawtable
      ?.drawbody?.draw as never,
  );
  if (drawRows.length === 0) {
    return null;
  }
  const byPosition = new Map<string, RawDrawSlot>();
  let maxLevel = 0;
  for (const row of drawRows) {
    const level = toNumber(row.alevel);
    byPosition.set(`${level}:${toNumber(row.rposition)}`, row);
    if (level > maxLevel) maxLevel = level;
  }
  const sideAt = (level: number, position: number): string[] => {
    const { name, name2 } = splitDrawSide(byPosition.get(`${level}:${position}`));
    return [name, name2].filter((value) => value !== "");
  };

  const rounds: TournamentBracketRound[] = [];
  for (let level = maxLevel - 1; level >= 0; level -= 1) {
    const matches: TournamentBracketMatch[] = [];
    for (let position = 0; position < 2 ** level; position += 1) {
      const slot = byPosition.get(`${level}:${position}`);
      const result = cleanText(slot?.result?.content ?? "").replace(/\//g, ":");
      const side1Names = sideAt(level + 1, position * 2);
      const side2Names = sideAt(level + 1, position * 2 + 1);
      const winnerName = splitDrawSide(slot).name;
      const winnerSide =
        winnerSideFromScore(result) ||
        (winnerName && winnerName === side1Names[0]
          ? 1
          : winnerName && winnerName === side2Names[0]
            ? 2
            : 0);
      matches.push({ side1Names, side2Names, result, winnerSide });
    }
    rounds.push({ roundName: roundName(level), matches });
  }
  return { rounds, championNames: sideAt(0, 0) };
}
