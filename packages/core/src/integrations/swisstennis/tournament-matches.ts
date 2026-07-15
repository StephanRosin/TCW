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
    const match = /^(\d+)[/:](\d+)$/.exec(set);
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

/** Dreht ein Satzresultat um: "6:2 6:1" → "2:6 1:6" (Nicht-Satz-Token bleiben). */
function flipSets(result: string): string {
  return result
    .split(/\s+/)
    .map((token) => {
      const match = /^(\d+):(\d+)$/.exec(token);
      return match ? `${match[2]}:${match[1]}` : token;
    })
    .join(" ");
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
  if (date?.year == null) return { date: "", time: "" };
  return {
    date: `${date.year}-${pad2((date.month ?? 0) + 1)}-${pad2(date.day ?? 1)}`,
    time: date.hour == null ? "" : `${pad2(date.hour)}:${pad2(date.minute ?? 0)}`,
  };
}

function rrResult(match: RawRrMatch): string {
  const comment = cleanText(match.rrmComment ?? "").replaceAll("/", ":");
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
  // Walkover: das gesetzte WO-Feld markiert den Sieger (Wert = zugesprochene
  // Sätze, z. B. 2), nicht den Verlierer.
  if (match.rrmPlayer1WO) return 1;
  if (match.rrmPlayer2WO) return 2;
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
        const fallbackKey = `${player1Names.name}:${player2Names.name}`;
        records.push({
          matchKey: `rr:${eventId}:${match.rRMatchId ?? fallbackKey}`,
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

function rankingPrefixTokens(content: string): { name: string; rankings: string[]; seed: string } {
  // Entfernt alle führenden "(…)"-Gruppen (Setzposition und/oder Klassierung).
  // Bei Doppeln enthält die Klassierungsgruppe beide Werte, z. B.
  // "(1) (R4/R3) Rosin Stephan" → [R4 (Spieler 1), R3 (Spieler 2)]. Eine rein
  // numerische Gruppe (z. B. "(1)") ist die Setzposition (Seed).
  let rest = cleanText(content);
  let rankings: string[] = [];
  let seed = "";
  const leadingGroup = /^\(([^)]*)\)\s*/;
  let match = leadingGroup.exec(rest);
  while (match) {
    const inner = (match[1] ?? "").trim();
    const tokens = inner
      .split("/")
      .map((part) => part.trim())
      .filter((part) => isRankingToken(part));
    if (tokens.length > 0 && rankings.length === 0) {
      rankings = tokens;
    } else if (seed === "" && /^\d+$/.test(inner)) {
      seed = inner;
    }
    rest = rest.slice(match[0].length);
    match = leadingGroup.exec(rest);
  }
  return { name: cleanText(rest), rankings, seed };
}

function splitDrawSide(row: RawDrawSlot | undefined): { name: string; name2: string; seed: string } {
  if (!row?.name) return { name: "", name2: "", seed: "" };
  const parsed = rankingPrefixTokens(cleanText(row.name.content ?? ""));
  const partner = cleanText(row.name.name2 ?? "").replace(/^\/\s*/, "");
  return {
    name: formatPlayer(parsed.name, parsed.rankings[0] ?? ""),
    name2: partner ? formatPlayer(partner, parsed.rankings[1] ?? "") : "",
    seed: parsed.seed,
  };
}

function parseCourt(court: RawDrawSlot["court"]): { date: string; time: string; court: string } {
  const raw = typeof court === "string" ? court : cleanText(court?.content ?? "");
  const match = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?:\s+\((.+?)\))?/.exec(raw);
  if (!match) {
    return { date: "", time: "", court: raw };
  }
  return {
    date: `20${match[3]}-${match[2]}-${match[1]}`,
    time: `${match[4]}:${match[5]}`,
    court: cleanText(match[6] ?? ""),
  };
}

interface DrawMatchNode {
  level: number;
  position: number;
  slot: RawDrawSlot | undefined;
  side1Names: string[];
  side2Names: string[];
  result: string;
  winnerSide: number;
}

interface DrawTree {
  maxLevel: number;
  /** Alle Match-Knoten, Level absteigend (Einstiegsrunde … Final). */
  nodes: DrawMatchNode[];
  championNames: string[];
  /** Setzposition je (formatiertem) Spielernamen – nur für die Baum-Anzeige. */
  seedByName: Map<string, string>;
}

/**
 * Liest den Tableau-Baum und propagiert die in der Einstiegsrunde vollständigen
 * Namen (mit Klassierung/Partner) nach oben. In Folgerunden speichert
 * Swisstennis nur Kurzformen ("Rosin S."); ohne Propagierung fehlten dort
 * Vorname und Klassierung – einheitliche Quelle für Baum und "Alle"-Liste.
 */
// Swisstennis-Tableau-Namen stehen als "Nachname Vorname"; das erste Token
// (der Nachname) identifiziert den Sieger auch in der Kurzform ("Rosin S.").
function surnameOf(names: string[]): string {
  return (names[0] ?? "").split(/\s+/)[0]?.toLowerCase() ?? "";
}

/**
 * Bestimmt Sieger-Seite, seiten-normierten Score und Sieger-Namen eines Tableau-Slots.
 * Sieger primär über den aufgestiegenen Namen: Im Tableau steht der Score aus
 * SIEGERSICHT (Sieger-Games zuerst), unabhängig von oberer/unterer Seite – als
 * Seiten-Indikator daher unbrauchbar. Nur wenn kein/uneindeutiger Name aufgestiegen
 * ist, ersatzweise aus dem Score ableiten. Der Score wird auf Seite-1-Sicht normiert
 * ("Seite1:Seite2"), konsistent zu Round-robin und IC/TC.
 */
function resolveDrawWinner(
  advanced: string[],
  side1Names: string[],
  side2Names: string[],
  rawResult: string,
): { winnerSide: number; result: string; winnerNames: string[] } {
  const advancedSurname = surnameOf(advanced);
  let winnerSide = 0;
  if (advancedSurname && advancedSurname === surnameOf(side1Names)) winnerSide = 1;
  else if (advancedSurname && advancedSurname === surnameOf(side2Names)) winnerSide = 2;
  if (winnerSide === 0) winnerSide = winnerSideFromScore(rawResult);
  const result = winnerSide === 2 ? flipSets(rawResult) : rawResult;
  let winnerNames: string[] = [];
  if (winnerSide === 1) winnerNames = side1Names;
  else if (winnerSide === 2) winnerNames = side2Names;
  else if (advanced.length > 0) winnerNames = advanced;
  return { winnerSide, result, winnerNames };
}

function buildDrawTree(payload: unknown): DrawTree | null {
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

  // Setzpositionen je Spielername (aus den Einstiegs-Slots) für die Baum-Anzeige.
  const seedByName = new Map<string, string>();
  for (const slot of byPosition.values()) {
    const side = splitDrawSide(slot);
    if (side.seed !== "" && side.name !== "") seedByName.set(side.name, side.seed);
  }

  const rawNamesAt = (level: number, position: number): string[] => {
    const { name, name2 } = splitDrawSide(byPosition.get(`${level}:${position}`));
    return [name, name2].filter((value) => value !== "");
  };

  const fullNames = new Map<string, string[]>();
  for (let position = 0; position < 2 ** maxLevel; position += 1) {
    fullNames.set(`${maxLevel}:${position}`, rawNamesAt(maxLevel, position));
  }

  const nodes: DrawMatchNode[] = [];
  for (let level = maxLevel - 1; level >= 0; level -= 1) {
    for (let position = 0; position < 2 ** level; position += 1) {
      const side1Names = fullNames.get(`${level + 1}:${position * 2}`) ?? [];
      const side2Names = fullNames.get(`${level + 1}:${position * 2 + 1}`) ?? [];
      const slot = byPosition.get(`${level}:${position}`);
      const rawResult = cleanText(slot?.result?.content ?? "").replaceAll("/", ":");
      const advanced = rawNamesAt(level, position);
      const { winnerSide, result, winnerNames } = resolveDrawWinner(advanced, side1Names, side2Names, rawResult);
      fullNames.set(`${level}:${position}`, winnerNames);
      nodes.push({ level, position, slot, side1Names, side2Names, result, winnerSide });
    }
  }
  return { maxLevel, nodes, championNames: fullNames.get("0:0") ?? [], seedByName };
}

function mapDrawMatches(payload: unknown, eventName: string, eventId: number): MatchRecord[] {
  const tree = buildDrawTree(payload);
  if (!tree) {
    return [];
  }
  const records: MatchRecord[] = [];
  for (const node of tree.nodes) {
    if (!node.slot?.court && !node.slot?.result?.content) {
      continue;
    }
    if (!isKnownPlayer(node.side1Names[0] ?? "") || !isKnownPlayer(node.side2Names[0] ?? "")) {
      continue;
    }
    const schedule = parseCourt(node.slot?.court);
    records.push({
      matchKey: `draw:${eventId}:${node.level}:${node.position}`,
      eventId,
      eventName,
      mode: "Draw",
      poolName: "",
      roundName: roundName(node.level),
      scheduledDate: schedule.date,
      scheduledTime: schedule.time,
      court: schedule.court,
      player1Name: node.side1Names[0] ?? "",
      player1Name2: node.side1Names[1] ?? "",
      player2Name: node.side2Names[0] ?? "",
      player2Name2: node.side2Names[1] ?? "",
      result: node.result,
      status: matchStatus(node.result),
      winnerSide: node.winnerSide,
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
  const tree = buildDrawTree(payload);
  if (!tree) {
    return null;
  }
  // Setzposition vor den ersten Namen einer Seite stellen (nur Baum-Anzeige;
  // die gespeicherten Match-Namen bleiben ohne Seed).
  const withSeed = (names: string[]): string[] => {
    const seed = names[0] ? tree.seedByName.get(names[0]) : undefined;
    return seed ? [`(${seed}) ${names[0]}`, ...names.slice(1)] : names;
  };
  const rounds: TournamentBracketRound[] = [];
  for (let level = tree.maxLevel - 1; level >= 0; level -= 1) {
    const matches: TournamentBracketMatch[] = tree.nodes
      .filter((node) => node.level === level)
      .map((node) => {
        const schedule = parseCourt(node.slot?.court);
        const scheduled =
          schedule.date || schedule.time || schedule.court
            ? { scheduledDate: schedule.date, scheduledTime: schedule.time, court: schedule.court }
            : {};
        return {
          side1Names: withSeed(node.side1Names),
          side2Names: withSeed(node.side2Names),
          result: node.result,
          winnerSide: node.winnerSide,
          ...scheduled,
        };
      });
    rounds.push({ roundName: roundName(level), matches });
  }
  return { rounds, championNames: withSeed(tree.championNames) };
}
