/**
 * Turnier-Matches aus DisplayDraw (Tableau) und DisplayPools (Round-robin).
 *
 * Es werden nur Partien übernommen, bei denen beide Seiten feststehen
 * (keine Platzhalter, kein "bye"/"noch offen").
 */
import { createHash } from "node:crypto";
import {
  isRankingToken,
  type PoolStanding,
  type TournamentBracket,
  type TournamentBracketMatch,
  type TournamentBracketRound,
  type TournamentMatchStatus,
} from "@tcw/shared";
import { asArray, cleanText, toNumber } from "./normalize.js";
import { scheduleFor, type ScheduleIndex } from "./tournament-schedule.js";

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

/**
 * Vergleicht nach Zeichenwert, nicht nach Sprachregeln.
 *
 * Die Sortierung geht in die abgeleitete Partie-ID ein, und dieselbe ID wird in
 * der Clubmeisterschaft (Python) und den Waidcup-Aufgaben berechnet. Pythons
 * `sorted()` vergleicht nach Codepoint – `localeCompare` täte das nicht und
 * würde die drei Anwendungen auseinanderlaufen lassen.
 */
function byCodeUnit(first: string, second: string): number {
  if (first < second) return -1;
  return first > second ? 1 : 0;
}

/** Setznummer "(1)" oder Klassierung "(R4/R3)", "(NC)" – auch mehrfach. */
const RANKING_TOKEN = /\((?:\d+|[NR]\d+|NC)(?:\/(?:[NR]\d+|NC))*\)/g;

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

interface RawPoolGame {
  teams?: { players?: string[] }[];
  score?: string;
  wo?: boolean;
  courtName?: string;
}

interface RawPoolGroup {
  name?: string;
  rankings?: RawPoolRanking[];
  games?: RawPoolGame[];
}

interface RawPoolRanking {
  players?: { name?: string; id?: number }[];
  victories?: string;
  sets?: string;
  games?: string;
  isDouble?: boolean;
  sort?: number;
}

/**
 * Stabile ID einer Gruppenpartie, abgeleitet aus Kategorie und Namen.
 *
 * Die Turnier-API gibt weder `rRMatchId` noch Spieler-IDs heraus. Die Seiten
 * werden sortiert, damit ein Tausch von Heim und Gast dieselbe ID ergibt;
 * Klassierungen und die Reihenfolge von Vor- und Nachname spielen keine Rolle.
 * Dieselbe Berechnung steckt in der Clubmeisterschaft und den
 * Waidcup-Aufgaben – die drei müssen übereinstimmen.
 */
export function roundRobinMatchId(eventId: number, firstTeam: string[], secondTeam: string[]): string {
  const sides = [teamKey(firstTeam), teamKey(secondTeam)].sort(byCodeUnit);
  const digest = createHash("sha1").update(`${eventId}|${sides[0]}|${sides[1]}`, "utf8").digest("hex");
  return `rr_${digest.slice(0, 12)}`;
}

function personKey(name: string): string {
  const withoutRanking = cleanText(name).replace(RANKING_TOKEN, " ");
  return (withoutRanking.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).sort(byCodeUnit).join(" ");
}

function teamKey(names: string[]): string {
  return names.filter((name) => name !== "").map(personKey).sort(byCodeUnit).join("+");
}

function mapRoundRobinMatches(
  payload: unknown,
  eventName: string,
  eventId: number,
  _isDouble: boolean,
  schedule?: ScheduleIndex,
): MatchRecord[] {
  const groups = asArray<RawPoolGroup>((payload as { groupCategories?: unknown } | null)?.groupCategories as never);
  const records: MatchRecord[] = [];

  for (const group of groups) {
    const poolName = cleanText(group.name ?? "");
    for (const game of asArray<RawPoolGame>(group.games as never)) {
      const teams = asArray<{ players?: string[] }>(game.teams as never);
      const first = asArray<string>(teams[0]?.players as never).map(cleanText).filter((name) => name !== "");
      const second = asArray<string>(teams[1]?.players as never).map(cleanText).filter((name) => name !== "");
      if (!isKnownPlayer(first[0] ?? "") || !isKnownPlayer(second[0] ?? "")) {
        continue;
      }
      // Bei einem Walkover liefert die Schnittstelle `wo: true` und ein leeres
      // Resultat - aber nicht mehr, welche Seite gewonnen hat. Die frühere
      // Schnittstelle hatte dafür ein Feld je Seite.
      const result = cleanText(game.score ?? "") || (game.wo === true ? "w.o." : "");
      const plan = scheduleFor(schedule, first, second);
      records.push({
        matchKey: `rr:${eventId}:${roundRobinMatchId(eventId, first, second)}`,
        eventId,
        eventName,
        mode: "Round-robin",
        poolName,
        roundName: poolName,
        scheduledDate: plan.date,
        scheduledTime: plan.time,
        court: plan.court || cleanText(game.courtName ?? ""),
        player1Name: first[0] ?? "",
        player1Name2: first[1] ?? "",
        player2Name: second[0] ?? "",
        player2Name2: second[1] ?? "",
        result,
        status: matchStatus(result),
        winnerSide: winnerSideFromScore(result),
      });
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
  result?: { content?: string };
}

const ROUND_NAMES: Record<number, string> = {
  0: "Final",
  1: "Halbfinal",
  2: "Viertelfinal",
  3: "Achtelfinal",
};

/**
 * Rundenname aus dem Level (0 = Final). Ab Level 4 die „1/N Final"-Schreibweise
 * (Level 4 = 1/16, 5 = 1/32, 6 = 1/64, 7 = 1/128 Final …) statt eines generischen
 * „Runde N". `translateRound` (@tcw/tournament-ui) übersetzt diese Namen.
 */
export function roundName(level: number): string {
  return ROUND_NAMES[level] ?? `1/${2 ** level} Final`;
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

interface RawGridNode {
  position?: { column?: number; row?: number };
  name1?: string;
  name2?: string;
  player1Number?: number;
  score?: string;
}

/**
 * Bringt das Tableau-Raster der Turnier-API auf die Slot-Form, mit der dieses
 * Modul seit jeher arbeitet – der Baumaufbau darunter bleibt unverändert.
 *
 * Spalte 1 sind die Ausgangspaarungen, die letzte Spalte ist der Sieger. Das
 * alte XML zählte andersherum (`alevel` 0 war das Final), deshalb
 * `alevel = columns - column`. `rposition` ist der Index innerhalb der Spalte,
 * nach Zeile sortiert.
 *
 * Vollständige Namen stehen nur in Spalte 1; spätere Spalten kürzen ab
 * ("Rosin S."), tragen aber dieselbe Spielernummer. Über sie wird der volle
 * Name zurückgeholt – sonst liesse sich der Sieger nicht sicher zuordnen.
 */
export function drawSlotsFromGrid(payload: unknown): RawDrawSlot[] {
  const grid = payload as { grid?: { columns?: number }; results?: unknown } | null;
  const columns = toNumber(grid?.grid?.columns);
  const nodes = asArray<RawGridNode>(grid?.results as never);
  if (columns < 2 || nodes.length === 0) {
    return [];
  }
  const byColumn = new Map<number, RawGridNode[]>();
  for (const node of nodes) {
    const column = toNumber(node.position?.column);
    const list = byColumn.get(column);
    if (list) list.push(node);
    else byColumn.set(column, [node]);
  }
  for (const list of byColumn.values()) {
    list.sort((a, b) => toNumber(a.position?.row) - toNumber(b.position?.row));
  }
  const leaves = new Map<number, RawGridNode>();
  for (const node of byColumn.get(1) ?? []) {
    if (node.player1Number !== undefined) leaves.set(node.player1Number, node);
  }

  const slots: RawDrawSlot[] = [];
  for (const [column, list] of byColumn) {
    list.forEach((node, index) => {
      const full = (node.player1Number !== undefined ? leaves.get(node.player1Number) : undefined) ?? node;
      slots.push({
        alevel: columns - column,
        rposition: index,
        name: { content: full.name1 ?? "", name2: full.name2 ?? "" },
        result: { content: node.score ?? "" },
      });
    });
  }
  return slots;
}

function buildDrawTree(payload: unknown): DrawTree | null {
  const drawRows = drawSlotsFromGrid(payload);
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

function mapDrawMatches(
  payload: unknown,
  eventName: string,
  eventId: number,
  scheduleIndex?: ScheduleIndex,
): MatchRecord[] {
  const tree = buildDrawTree(payload);
  if (!tree) {
    return [];
  }
  const records: MatchRecord[] = [];
  for (const node of tree.nodes) {
    if (!isKnownPlayer(node.side1Names[0] ?? "") || !isKnownPlayer(node.side2Names[0] ?? "")) {
      continue;
    }
    const schedule = scheduleFor(scheduleIndex, node.side1Names, node.side2Names);
    // Ohne Resultat und ohne Termin ist die Partie noch nicht angesetzt.
    if (node.result === "" && schedule.date === "") {
      continue;
    }
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
  schedule?: ScheduleIndex,
): MatchRecord[] {
  if (mode === "Draw") {
    return mapDrawMatches(payload, eventName, eventId, schedule);
  }
  if (mode === "Round-robin") {
    return mapRoundRobinMatches(payload, eventName, eventId, isDouble, schedule);
  }
  return [];
}

// --------------------------------------------------------------------------
// Round-robin-Tabelle (DisplayPools)
// --------------------------------------------------------------------------

/**
 * Liefert die offizielle Gruppentabelle je Gruppe.
 *
 * Die neue Schnittstelle liefert Siege, Sätze und Games bereits als fertige
 * Zeichenketten ("3/3", "6/2", "49/41") und den Rang als `sort`. Die Anzahl
 * gespielter Partien steckt im Nenner der Siege.
 */
export function mapPoolStandings(payload: unknown, _isDouble: boolean): PoolStanding[] {
  const groups = asArray<RawPoolGroup>((payload as { groupCategories?: unknown } | null)?.groupCategories as never);
  return groups
    .map((group) => {
      const rows = asArray<RawPoolRanking>(group.rankings as never)
        .map((entry) => {
          const names = asArray<{ name?: string }>(entry.players as never)
            .map((player) => cleanText(player.name ?? ""))
            .filter((name) => name !== "");
          const [victories, matches] = cleanText(entry.victories ?? "").split("/");
          return {
            rank: toNumber(entry.sort, 0),
            names,
            matches: toNumber(matches),
            victories: toNumber(victories),
            sets: cleanText(entry.sets ?? "").replace("/", ":"),
            games: cleanText(entry.games ?? "").replace("/", ":"),
          };
        })
        .filter((row) => row.names.length > 0)
        .sort((a, b) => a.rank - b.rank);
      return { poolName: cleanText(group.name ?? ""), rows };
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
export function mapDrawBracket(payload: unknown, scheduleIndex?: ScheduleIndex): TournamentBracket | null {
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
        const schedule = scheduleFor(scheduleIndex, node.side1Names, node.side2Names);
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
