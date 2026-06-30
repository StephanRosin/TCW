/**
 * Spielerzentrierte Matchhistorie (aktuelles Jahr) über alle Wettbewerbe.
 *
 * Datenquellen (alle öffentlich):
 *  - IC-Begegnungen aus der `matches`-Tabelle → Detail live via EncountResults.
 *  - TC-Begegnungen über den Team-Challenge-Results-Walk (listTeams → team).
 *  - Waidcup/Clubmeisterschaft aus den bereits gespeicherten `tournament_matches`.
 *
 * Schonend: pro Begegnung wird nur dann (erneut) geladen, wenn sie neu oder ihr
 * Resultat geändert ist (`encounter_detail_state`). Gegner-Profil-URLs werden
 * einmalig über die Namenssuche aufgelöst und gecacht (`opponent_url_cache`).
 */
import type Database from "better-sqlite3";
import {
  OWN_CLUB_ID,
  cleanPlayerName,
  playerNameKey,
  safeExternalUrl,
  type EncountDetailResponse,
  type PlayerMatchView,
  type PlayerMatchParticipant,
  type PlayerSuggestion,
  type ResultType,
} from "@tcw/shared";
import type { AppConfig } from "../config.js";
import { createResultsService } from "./results-service.js";
import { INTERCLUB, TEAM_CHALLENGE } from "../integrations/swisstennis/competition.js";
import { tournamentDisplayUrl } from "../integrations/swisstennis/tournament-urls.js";
import { chooseBestHit, searchPlayers } from "../integrations/mytennis/search.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface SyncOptions {
  /** Pause zwischen Swisstennis-Abrufen (Begegnungen, Namenssuche). */
  delayMs?: number;
  /** true = bereits importierte Begegnungen ignorieren und alles neu laden. */
  force?: boolean;
  /** Gegner-Profil-URLs über die Namenssuche auflösen (kostet API-Calls). */
  resolveUrls?: boolean;
  /** Obergrenze neuer Detail-Abrufe je Wettbewerb und Lauf (Schonung der API). */
  maxEncounters?: number;
  /** Obergrenze neuer Gegner-Namenssuchen je Lauf. */
  maxUrlLookups?: number;
  log?: (message: string) => void;
}

interface MatchRecord {
  matchUid: string;
  competitionCode: string;
  competitionLabel: string;
  discipline: "single" | "double";
  date: string;
  side1: string[];
  side2: string[];
  result: string;
  winnerSide: number;
  matchUrl: string | null;
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/** Aktuelles Saison-Jahr = jüngstes Jahr in der Begegnungstabelle. */
function currentYear(db: Database.Database): string {
  const row = db.prepare("SELECT MAX(CAST(year AS INTEGER)) y FROM matches").get() as { y: number | null };
  return String(row.y ?? new Date().getFullYear());
}

/** "35+ NLC Herren (Grp 7)" → "35+ NLC" (ohne Gruppe/Geschlecht). */
function shortLiga(liga: string): string {
  return liga
    .replace(/\(grp[^)]*\)/gi, "")
    .replace(/\b(herren|damen|mixed|men|women)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dreht Satzergebnisse um: "6:3 6:4" → "3:6 4:6". Lässt w.o./leer unberührt-gespiegelt. */
function flipScore(score: string): string {
  return score
    .split(/\s+/)
    .map((token) => {
      const match = /^(\d+):(\d+)$/.exec(token);
      return match ? `${match[2]}:${match[1]}` : token;
    })
    .join(" ");
}

/** Sortierschlüssel (ISO YYYY-MM-DD) aus "D.M.YYYY" oder ISO; sonst "". */
export function toSortKey(date: string): string {
  const value = date.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  if (match) return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  return "";
}

function hashResult(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return String(hash);
}

// ---------------------------------------------------------------------------
// Extraktion einzelner Matches aus einer Begegnung
// ---------------------------------------------------------------------------

function extractEncounter(
  detail: EncountDetailResponse,
  encountId: number,
  competitionCode: string,
  fallbackLiga: string,
): MatchRecord[] {
  const liga = detail.liga || fallbackLiga;
  const label = competitionCode === "tc" ? "TC" : `IC ${shortLiga(liga)}`.trim();
  const records: MatchRecord[] = [];
  const groups: Array<{ discipline: "single" | "double"; matches: EncountDetailResponse["singles"] }> = [
    { discipline: "single", matches: detail.singles },
    { discipline: "double", matches: detail.doubles },
  ];
  for (const { discipline, matches } of groups) {
    for (const m of matches) {
      const played = m.score.trim() !== "" || m.homeWon !== null;
      if (!played) continue;
      records.push({
        matchUid: `${competitionCode}:${encountId}:${discipline}:${m.position}`,
        competitionCode,
        competitionLabel: label,
        discipline,
        date: detail.date,
        side1: m.homeNames, // Heim = Seite 1 (Resultat aus Heimsicht)
        side2: m.awayNames,
        result: m.score,
        winnerSide: m.homeWon === null ? 0 : m.homeWon ? 1 : 2,
        matchUrl: detail.swisstennisUrl || null,
      });
    }
  }
  return records;
}

// ---------------------------------------------------------------------------
// Persistenz
// ---------------------------------------------------------------------------

function upsertRecords(db: Database.Database, year: string, records: MatchRecord[], now: string): void {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO player_matches (
       match_uid, year, competition_code, competition_label, discipline, match_date, sort_key,
       s1p1_name, s1p1_key, s1p2_name, s1p2_key,
       s2p1_name, s2p1_key, s2p2_name, s2p2_key,
       result, winner_side, match_url, updated_at
     ) VALUES (
       @matchUid, @year, @competitionCode, @competitionLabel, @discipline, @date, @sortKey,
       @s1p1n, @s1p1k, @s1p2n, @s1p2k, @s2p1n, @s2p1k, @s2p2n, @s2p2k,
       @result, @winnerSide, @matchUrl, @now
     )`,
  );
  const tx = db.transaction((rows: MatchRecord[]) => {
    for (const r of rows) {
      // Anzeigename mit Klassierung erhalten; der Schlüssel ist klassierungsfrei.
      const s1 = r.side1.map((n) => n.trim());
      const s2 = r.side2.map((n) => n.trim());
      stmt.run({
        matchUid: r.matchUid,
        year: Number(year),
        competitionCode: r.competitionCode,
        competitionLabel: r.competitionLabel,
        discipline: r.discipline,
        date: r.date,
        sortKey: toSortKey(r.date),
        s1p1n: s1[0] ?? "",
        s1p1k: s1[0] ? playerNameKey(s1[0]) : "",
        s1p2n: s1[1] ?? "",
        s1p2k: s1[1] ? playerNameKey(s1[1]) : "",
        s2p1n: s2[0] ?? "",
        s2p1k: s2[0] ? playerNameKey(s2[0]) : "",
        s2p2n: s2[1] ?? "",
        s2p2k: s2[1] ? playerNameKey(s2[1]) : "",
        result: r.result,
        winnerSide: r.winnerSide,
        matchUrl: r.matchUrl,
        now,
      });
    }
  });
  tx(records);
}

// ---------------------------------------------------------------------------
// Import: IC / TC-Begegnungen (inkrementell)
// ---------------------------------------------------------------------------

interface EncounterRef {
  encountId: number;
  result: string;
  liga: string;
  playoff: boolean;
}

async function importEncounters(
  db: Database.Database,
  config: AppConfig,
  competitionCode: "ic" | "tc",
  year: string,
  refs: EncounterRef[],
  opts: Required<Pick<SyncOptions, "delayMs" | "force">> & { maxEncounters: number; log: (m: string) => void },
): Promise<number> {
  const service = createResultsService(config, competitionCode === "ic" ? INTERCLUB : TEAM_CHALLENGE);
  const getState = db.prepare(
    "SELECT result_hash FROM encounter_detail_state WHERE competition_code=? AND encount_id=?",
  );
  const setState = db.prepare(
    `INSERT OR REPLACE INTO encounter_detail_state (competition_code, encount_id, result_hash, imported_at)
     VALUES (?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  let imported = 0;
  let fetched = 0;
  for (const ref of refs) {
    if (fetched >= opts.maxEncounters) {
      opts.log(`  ${competitionCode}: Limit ${opts.maxEncounters} erreicht, Rest folgt im nächsten Lauf`);
      break;
    }
    const hash = hashResult(ref.result);
    if (!opts.force) {
      const state = getState.get(competitionCode, ref.encountId) as { result_hash: string } | undefined;
      if (state && state.result_hash === hash) continue;
    }
    fetched++;
    const type: ResultType = ref.playoff ? "tableau" : "encount";
    try {
      const detail = await service.getEncountDetail(ref.encountId, year, type);
      // Nur Begegnungen mit Waidberg-Beteiligung (Sicherheitsnetz).
      const involvesOwn = detail.homeClubNb === OWN_CLUB_ID || /waidberg/i.test(detail.awayTeam);
      if (involvesOwn) {
        const records = extractEncounter(detail, ref.encountId, competitionCode, ref.liga);
        upsertRecords(db, year, records, now);
        imported++;
        opts.log(`  ${competitionCode} ${ref.encountId}: ${records.length} Matches`);
      }
      setState.run(competitionCode, ref.encountId, hash, now);
    } catch (err) {
      opts.log(`  ! ${competitionCode} ${ref.encountId}: ${(err as Error).message}`);
    }
    await sleep(opts.delayMs);
  }
  return imported;
}

/** IC-Begegnungs-Referenzen aus der `matches`-Tabelle (nur mit Resultat). */
function icRefs(db: Database.Database, year: string): EncounterRef[] {
  const rows = db
    .prepare(
      `SELECT encount_id, result, liga, playoff FROM matches
       WHERE year=? AND encount_id>0 AND TRIM(result)<>'' ORDER BY date`,
    )
    .all(year) as Array<{ encount_id: number; result: string; liga: string; playoff: number }>;
  return rows.map((r) => ({ encountId: r.encount_id, result: r.result, liga: r.liga, playoff: r.playoff === 1 }));
}

/** TC-Begegnungs-Referenzen über den Team-Challenge-Results-Walk. */
async function tcRefs(db: Database.Database, config: AppConfig, year: string, delayMs: number): Promise<EncounterRef[]> {
  const service = createResultsService(config, TEAM_CHALLENGE);
  const teams = await service.listTeams(year);
  const seen = new Map<number, EncounterRef>();
  for (const team of teams.items) {
    try {
      const result = await service.getTeamResults(team.teamId, year);
      for (const m of result.matches) {
        if (m.encountId > 0 && m.result.trim() !== "" && !seen.has(m.encountId)) {
          seen.set(m.encountId, { encountId: m.encountId, result: m.result, liga: result.liga, playoff: false });
        }
      }
    } catch {
      /* einzelnes Team überspringen */
    }
    await sleep(delayMs);
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Import: Turniere (Waidcup / Clubmeisterschaft) aus der DB
// ---------------------------------------------------------------------------

function tournamentCode(name: string): { code: string; label: string } {
  if (/waidcup/i.test(name)) return { code: "waidcup", label: "Waidcup" };
  if (/clubmeister|^cm$/i.test(name)) return { code: "cm", label: "CM" };
  return { code: "tournament", label: name };
}

function importTournaments(db: Database.Database, year: string, now: string): number {
  const rows = db
    .prepare(
      `SELECT tm.tournament_id, tm.event_id, tm.match_key, tm.player1_name, tm.player1_name_2,
              tm.player2_name, tm.player2_name_2, tm.result, tm.winner_side, tm.scheduled_date,
              t.name AS tournament_name, t.swisstennis_tournament_id AS st_id
       FROM tournament_matches tm
       JOIN tournaments t ON t.swisstennis_tournament_id = tm.tournament_id
       WHERE TRIM(tm.result)<>''`,
    )
    .all() as Array<Record<string, string | number | null>>;
  const records: MatchRecord[] = rows.map((r) => {
    const { code, label } = tournamentCode(String(r.tournament_name ?? ""));
    const side1 = [r.player1_name, r.player1_name_2].filter(Boolean).map(String);
    const side2 = [r.player2_name, r.player2_name_2].filter(Boolean).map(String);
    return {
      matchUid: `tour:${r.tournament_id}:${r.event_id}:${r.match_key}`,
      competitionCode: code,
      competitionLabel: label,
      discipline: side1.length > 1 ? "double" : "single",
      date: String(r.scheduled_date ?? ""),
      side1,
      side2,
      result: String(r.result ?? ""),
      winnerSide: Number(r.winner_side ?? 0),
      matchUrl: tournamentDisplayUrl(Number(r.st_id)),
    };
  });
  upsertRecords(db, year, records, now);
  return records.length;
}

// ---------------------------------------------------------------------------
// Profil-URLs: eigene Spieler aus `players`, Gegner über die Namenssuche
// ---------------------------------------------------------------------------

const SLOTS = [
  ["s1p1_name", "s1p1_key", "s1p1_url"],
  ["s1p2_name", "s1p2_key", "s1p2_url"],
  ["s2p1_name", "s2p1_key", "s2p1_url"],
  ["s2p2_name", "s2p2_key", "s2p2_url"],
] as const;

/** Setzt URLs eigener Spieler (myTennisID) – ohne API-Aufruf. */
function applyOwnUrls(db: Database.Database): void {
  const players = db.prepare("SELECT name, myTennisID FROM players WHERE TRIM(myTennisID)<>''").all() as Array<{
    name: string;
    myTennisID: string;
  }>;
  const ownByKey = new Map<string, string>();
  for (const p of players) {
    const url = safeExternalUrl(p.myTennisID);
    if (url) ownByKey.set(playerNameKey(p.name), url);
  }
  for (const [, keyCol, urlCol] of SLOTS) {
    const update = db.prepare(`UPDATE player_matches SET ${urlCol}=? WHERE ${keyCol}=? AND (${urlCol} IS NULL OR ${urlCol}='')`);
    for (const [key, url] of ownByKey) update.run(url, key);
  }
}

/** Löst fehlende Gegner-URLs über die Namenssuche auf (gecacht, mit Pause). */
async function resolveOpponentUrls(
  db: Database.Database,
  config: AppConfig,
  delayMs: number,
  maxLookups: number,
  log: (m: string) => void,
): Promise<number> {
  // Alle Namen/Schlüssel ohne URL einsammeln.
  const needed = new Map<string, string>(); // key → Anzeigename
  for (const [nameCol, keyCol, urlCol] of SLOTS) {
    const rows = db
      .prepare(`SELECT DISTINCT ${keyCol} k, ${nameCol} n FROM player_matches WHERE ${keyCol}<>'' AND (${urlCol} IS NULL OR ${urlCol}='')`)
      .all() as Array<{ k: string; n: string }>;
    for (const r of rows) if (!needed.has(r.k)) needed.set(r.k, r.n);
  }
  const cacheGet = db.prepare("SELECT url FROM opponent_url_cache WHERE name_key=?");
  const cacheSet = db.prepare("INSERT OR REPLACE INTO opponent_url_cache (name_key, url, resolved_at) VALUES (?, ?, ?)");
  let resolved = 0;
  let lookups = 0;
  for (const [key, displayName] of needed) {
    let url: string | null;
    const cached = cacheGet.get(key) as { url: string | null } | undefined;
    if (cached) {
      url = cached.url;
    } else {
      if (lookups >= maxLookups) {
        log(`  URL-Lookup-Limit ${maxLookups} erreicht, Rest folgt`);
        break;
      }
      lookups++;
      url = await lookupUrl(displayName, config.swisstennisTimeoutMs);
      cacheSet.run(key, url, new Date().toISOString());
      log(`  url ${displayName} → ${url ?? "—"}`);
      await sleep(delayMs);
    }
    if (url) {
      for (const [, keyCol, urlCol] of SLOTS) {
        db.prepare(`UPDATE player_matches SET ${urlCol}=? WHERE ${keyCol}=? AND (${urlCol} IS NULL OR ${urlCol}='')`).run(url, key);
      }
      resolved++;
    }
  }
  return resolved;
}

async function lookupUrl(name: string, timeoutMs: number): Promise<string | null> {
  const clean = cleanPlayerName(name);
  const tokens = clean.split(/\s+/).filter((t) => t !== "");
  if (tokens.length < 2) return null;
  const hits = await searchPlayers(clean, timeoutMs);
  const best = chooseBestHit(hits, tokens[0]!, tokens[tokens.length - 1]!);
  return best ? best.url : null;
}

// ---------------------------------------------------------------------------
// Öffentliche Sync-Funktion
// ---------------------------------------------------------------------------

export async function syncPlayerMatches(db: Database.Database, config: AppConfig, opts: SyncOptions = {}): Promise<void> {
  const delayMs = opts.delayMs ?? 4000;
  const force = opts.force ?? false;
  const resolveUrls = opts.resolveUrls ?? true;
  const maxEncounters = opts.maxEncounters ?? Number.POSITIVE_INFINITY;
  const maxUrlLookups = opts.maxUrlLookups ?? Number.POSITIVE_INFINITY;
  const log = opts.log ?? (() => {});
  const year = currentYear(db);
  const now = new Date().toISOString();

  log(`Sync Spielermatches ${year} (delay ${delayMs}ms, force=${force})`);

  const ic = await importEncounters(db, config, "ic", year, icRefs(db, year), { delayMs, force, maxEncounters, log });
  log(`IC: ${ic} Begegnungen importiert`);

  const tcReferences = await tcRefs(db, config, year, delayMs);
  const tc = await importEncounters(db, config, "tc", year, tcReferences, { delayMs, force, maxEncounters, log });
  log(`TC: ${tc} Begegnungen importiert (${tcReferences.length} bekannt)`);

  const tour = importTournaments(db, year, now);
  log(`Turniere: ${tour} Matches`);

  applyOwnUrls(db);
  if (resolveUrls) {
    const urls = await resolveOpponentUrls(db, config, delayMs, maxUrlLookups, log);
    log(`Gegner-URLs aufgelöst: ${urls}`);
  }
  log("Sync fertig.");
}

// ---------------------------------------------------------------------------
// Read: Vorschläge + Matchliste
// ---------------------------------------------------------------------------

/** Autocomplete: erfasste Vereinsspieler, deren Name `q` enthält (ab 3 Zeichen). */
export function suggestPlayers(db: Database.Database, q: string, limit = 10): PlayerSuggestion[] {
  const query = q.trim();
  if (query.length < 3) return [];
  const rows = db
    .prepare("SELECT name, klassierung, myTennisID FROM players WHERE name LIKE ? ORDER BY name")
    .all(`%${query}%`) as Array<{ name: string; klassierung: string; myTennisID: string }>;
  const byKey = new Map<string, PlayerSuggestion>();
  for (const r of rows) {
    const key = playerNameKey(r.name);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      name: r.name,
      key,
      klassierung: r.klassierung ?? "",
      url: safeExternalUrl(r.myTennisID) || null,
    });
    if (byKey.size >= limit) break;
  }
  return [...byKey.values()];
}

interface PlayerMatchRow {
  competition_code: string;
  competition_label: string;
  discipline: "single" | "double";
  match_date: string;
  s1p1_name: string; s1p1_key: string; s1p1_url: string | null;
  s1p2_name: string; s1p2_key: string; s1p2_url: string | null;
  s2p1_name: string; s2p1_key: string; s2p1_url: string | null;
  s2p2_name: string; s2p2_key: string; s2p2_url: string | null;
  result: string;
  winner_side: number;
  match_url: string | null;
}

/** Alle Matches des aktuellen Jahres für den Spieler mit dem Namens-Schlüssel `key`. */
export function getPlayerMatches(db: Database.Database, key: string): PlayerMatchView[] {
  const year = currentYear(db);
  const rows = db
    .prepare(
      `SELECT * FROM player_matches
       WHERE year=? AND (s1p1_key=? OR s1p2_key=? OR s2p1_key=? OR s2p2_key=?)
       ORDER BY sort_key DESC, match_uid DESC`,
    )
    .all(Number(year), key, key, key, key) as PlayerMatchRow[];

  return rows.map((row) => {
    const playerSide = row.s1p1_key === key || row.s1p2_key === key ? 1 : 2;
    const own = playerSide === 1
      ? [{ name: row.s1p1_name, key: row.s1p1_key, url: row.s1p1_url }, { name: row.s1p2_name, key: row.s1p2_key, url: row.s1p2_url }]
      : [{ name: row.s2p1_name, key: row.s2p1_key, url: row.s2p1_url }, { name: row.s2p2_name, key: row.s2p2_key, url: row.s2p2_url }];
    const opp = playerSide === 1
      ? [{ name: row.s2p1_name, url: row.s2p1_url }, { name: row.s2p2_name, url: row.s2p2_url }]
      : [{ name: row.s1p1_name, url: row.s1p1_url }, { name: row.s1p2_name, url: row.s1p2_url }];

    const playerSlot = own.find((p) => p.key === key) ?? own[0]!;
    const partnerSlot = own.find((p) => p.key !== key && p.name !== "");
    const player: PlayerMatchParticipant = { name: playerSlot.name, url: playerSlot.url };
    const partner: PlayerMatchParticipant | null = partnerSlot ? { name: partnerSlot.name, url: partnerSlot.url } : null;
    const opponents: PlayerMatchParticipant[] = opp.filter((o) => o.name !== "").map((o) => ({ name: o.name, url: o.url }));

    return {
      competition: row.competition_label,
      competitionCode: row.competition_code,
      discipline: row.discipline,
      date: row.match_date,
      player,
      partner,
      opponents,
      result: playerSide === 2 ? flipScore(row.result) : row.result,
      won: row.winner_side === 0 ? null : row.winner_side === playerSide,
      matchUrl: row.match_url,
    };
  });
}
