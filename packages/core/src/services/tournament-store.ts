/**
 * Datenbankzugriff für die nativ integrierten Turniere: Konfiguration lesen,
 * importierte Daten atomar ersetzen und für die öffentliche Anzeige aufbereiten.
 */
import {
  disciplineOf,
  registrationUrlForId,
  type Discipline,
  type PoolStanding,
  type RegistrationPlayer,
  type TournamentBracket,
  type TournamentEventView,
  type TournamentMatch,
  type TournamentMatchStatus,
  type TournamentsResponse,
  type TournamentView,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";
import type { RegistrationRecord } from "../integrations/swisstennis/tournament-registrations.js";
import type { MatchRecord } from "../integrations/swisstennis/tournament-matches.js";
import type { TournamentEventMeta } from "../integrations/swisstennis/tournament-events.js";

export interface TournamentConfig {
  id: number;
  name: string;
  swisstennisTournamentId: number;
  registrationUrl: string;
  active: boolean;
  sortOrder: number;
}

export interface ExistingPlayerUrl {
  licenseNumber: string | null;
  licenseNumber2: string | null;
  playerUrl: string | null;
  playerUrl2: string | null;
}

interface ConfigRow {
  id: number;
  name: string;
  swisstennis_tournament_id: number;
  registration_url: string | null;
  active: number;
  sort_order: number;
}

function toConfig(row: ConfigRow): TournamentConfig {
  return {
    id: row.id,
    name: row.name,
    swisstennisTournamentId: row.swisstennis_tournament_id,
    registrationUrl: row.registration_url ?? registrationUrlForId(row.swisstennis_tournament_id),
    active: row.active === 1,
    sortOrder: row.sort_order,
  };
}

export function readTournamentConfigs(database: TcwDatabase, activeOnly: boolean): TournamentConfig[] {
  const where = activeOnly ? "WHERE active = 1" : "";
  const rows = database
    .prepare(
      `SELECT id, name, swisstennis_tournament_id, registration_url, active, sort_order
       FROM tournaments ${where}
       ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all() as ConfigRow[];
  return rows.map(toConfig);
}

export function readExistingPlayerUrls(
  database: TcwDatabase,
  tournamentId: number,
): Map<string, ExistingPlayerUrl> {
  const rows = database
    .prepare(
      `SELECT player_key, license_number, license_number_2, player_url, player_url_2
       FROM tournament_players WHERE tournament_id = ?`,
    )
    .all(tournamentId) as Array<{
    player_key: string;
    license_number: string | null;
    license_number_2: string | null;
    player_url: string | null;
    player_url_2: string | null;
  }>;
  const map = new Map<string, ExistingPlayerUrl>();
  for (const row of rows) {
    map.set(row.player_key, {
      licenseNumber: row.license_number,
      licenseNumber2: row.license_number_2,
      playerUrl: row.player_url,
      playerUrl2: row.player_url_2,
    });
  }
  return map;
}

export interface EventImport {
  meta: TournamentEventMeta;
  registrations: Array<RegistrationRecord & { playerUrl: string; playerUrl2: string }>;
  matches: MatchRecord[];
  pools: PoolStanding[];
  bracket: TournamentBracket | null;
}

/** Bestehende Match-Zeile (für den änderungsbewussten Abgleich). */
interface ExistingMatchRow {
  match_key: string;
  event_id: number;
  tournament_name: string | null;
  event_name: string | null;
  mode: string | null;
  pool_name: string | null;
  round_name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  court: string | null;
  player1_name: string | null;
  player1_name_2: string | null;
  player2_name: string | null;
  player2_name_2: string | null;
  result: string | null;
  status: string | null;
  winner_side: number | null;
  sort_order: number | null;
  result_seen_at: string | null;
}

const MATCH_TEXT_FIELDS = [
  "tournament_name",
  "event_name",
  "mode",
  "pool_name",
  "round_name",
  "scheduled_date",
  "scheduled_time",
  "court",
  "player1_name",
  "player1_name_2",
  "player2_name",
  "player2_name_2",
  "result",
  "status",
] as const;

/** Ob sich ein inhaltliches Feld gegenüber dem gespeicherten Stand geändert hat. */
function matchChanged(previous: ExistingMatchRow, next: Record<string, unknown>): boolean {
  for (const field of MATCH_TEXT_FIELDS) {
    if (String(previous[field] ?? "") !== String(next[field] ?? "")) return true;
  }
  return (
    Number(previous.winner_side ?? 0) !== Number(next.winner_side ?? 0) ||
    Number(previous.sort_order ?? 0) !== Number(next.sort_order ?? 0)
  );
}

/**
 * Zeitpunkt des ersten Ergebnisses (~ Spieltag). Einmal gesetzt, bleibt er
 * erhalten. Für Partien, die bereits mit Ergebnis in der DB lagen, bevor wir
 * dies verfolgt haben, bleibt er leer (kein erfundenes Datum).
 */
function computeResultSeen(
  previous: ExistingMatchRow | undefined,
  result: string,
  importedAt: string,
): string | null {
  const previousSeen = previous?.result_seen_at ?? null;
  if (previousSeen) return previousSeen;
  if (result.trim() === "") return null;
  if (!previous) return importedAt; // neue Partie, kommt bereits mit Ergebnis → gerade gespielt
  const hadResult = String(previous.result ?? "").trim() !== "";
  return hadResult ? null : importedAt; // vorbestehendes Ergebnis: unbekannt; sonst frischer Übergang
}

/** Ersetzt alle importierten Daten eines Turniers atomar (alte bleiben bei Fehler erhalten). */
export function replaceTournamentData(
  database: TcwDatabase,
  tournamentId: number,
  tournamentName: string,
  events: EventImport[],
  importedAt: string,
): void {
  const deletePlayers = database.prepare("DELETE FROM tournament_players WHERE tournament_id = ?");
  const deleteExtras = database.prepare("DELETE FROM tournament_event_extras WHERE tournament_id = ?");
  const deleteEvents = database.prepare("DELETE FROM tournament_events WHERE tournament_id = ?");
  const insertExtras = database.prepare(
    `INSERT INTO tournament_event_extras (tournament_id, event_id, pools_json, bracket_json)
     VALUES (@tournament_id, @event_id, @pools_json, @bracket_json)`,
  );
  const insertEvent = database.prepare(
    `INSERT INTO tournament_events (tournament_id, event_id, tournament_name, event_name, discipline, source_descr, sort_order, updated_at)
     VALUES (@tournament_id, @event_id, @tournament_name, @event_name, @discipline, @source_descr, @sort_order, @updated_at)`,
  );
  const insertPlayer = database.prepare(
    `INSERT OR IGNORE INTO tournament_players (tournament_id, event_id, player_key, player_name, player_name_2, license_number, license_number_2, player_url, player_url_2, confirmed, ranking, ranking_2, registered_on, note, sort_order)
     VALUES (@tournament_id, @event_id, @player_key, @player_name, @player_name_2, @license_number, @license_number_2, @player_url, @player_url_2, @confirmed, @ranking, @ranking_2, @registered_on, @note, @sort_order_player)`,
  );
  const selectExistingMatches = database.prepare(
    `SELECT match_key, event_id, tournament_name, event_name, mode, pool_name, round_name,
            scheduled_date, scheduled_time, court, player1_name, player1_name_2, player2_name,
            player2_name_2, result, status, winner_side, sort_order, result_seen_at
     FROM tournament_matches WHERE tournament_id = ?`,
  );
  const insertMatch = database.prepare(
    `INSERT INTO tournament_matches (tournament_id, event_id, match_key, tournament_name, event_name, mode, pool_name, round_name, scheduled_date, scheduled_time, court, player1_name, player1_name_2, player2_name, player2_name_2, result, status, winner_side, sort_order, updated_at, result_seen_at)
     VALUES (@tournament_id, @event_id, @match_key, @tournament_name, @event_name, @mode, @pool_name, @round_name, @scheduled_date, @scheduled_time, @court, @player1_name, @player1_name_2, @player2_name, @player2_name_2, @result, @status, @winner_side, @sort_order, @updated_at, @result_seen_at)`,
  );
  const updateMatch = database.prepare(
    `UPDATE tournament_matches SET tournament_name=@tournament_name, event_name=@event_name, mode=@mode,
            pool_name=@pool_name, round_name=@round_name, scheduled_date=@scheduled_date,
            scheduled_time=@scheduled_time, court=@court, player1_name=@player1_name,
            player1_name_2=@player1_name_2, player2_name=@player2_name, player2_name_2=@player2_name_2,
            result=@result, status=@status, winner_side=@winner_side, sort_order=@sort_order,
            updated_at=@updated_at, result_seen_at=@result_seen_at
     WHERE tournament_id=@tournament_id AND event_id=@event_id AND match_key=@match_key`,
  );
  const deleteMatch = database.prepare(
    "DELETE FROM tournament_matches WHERE tournament_id = ? AND event_id = ? AND match_key = ?",
  );

  const run = database.transaction(() => {
    deletePlayers.run(tournamentId);
    deleteExtras.run(tournamentId);
    deleteEvents.run(tournamentId);

    // Matches werden änderungsbewusst abgeglichen (kein blindes Löschen), damit
    // updated_at und result_seen_at nur bei echten Änderungen wandern.
    const existingMatches = new Map<string, ExistingMatchRow>();
    for (const row of selectExistingMatches.all(tournamentId) as ExistingMatchRow[]) {
      existingMatches.set(row.match_key, row);
    }
    const incomingKeys = new Set<string>();

    for (const event of events) {
      insertEvent.run({
        tournament_id: tournamentId,
        event_id: event.meta.eventId,
        tournament_name: tournamentName,
        event_name: event.meta.eventName,
        discipline: event.meta.discipline,
        source_descr: null,
        sort_order: event.meta.sortOrder,
        updated_at: importedAt,
      });
      for (const player of event.registrations) {
        insertPlayer.run({
          tournament_id: tournamentId,
          event_id: event.meta.eventId,
          player_key: player.playerKey,
          player_name: player.playerName,
          player_name_2: player.playerName2,
          license_number: player.licenseNumber,
          license_number_2: player.licenseNumber2,
          player_url: player.playerUrl || null,
          player_url_2: player.playerUrl2 || null,
          confirmed: player.confirmed,
          ranking: player.ranking,
          ranking_2: player.ranking2,
          registered_on: player.registeredOn,
          sort_order_player: player.sortOrder,
          note: player.note,
        });
      }
      event.matches.forEach((match, index) => {
        incomingKeys.add(match.matchKey);
        const previous = existingMatches.get(match.matchKey);
        const params = {
          tournament_id: tournamentId,
          event_id: event.meta.eventId,
          match_key: match.matchKey,
          tournament_name: tournamentName,
          event_name: match.eventName,
          mode: match.mode,
          pool_name: match.poolName,
          round_name: match.roundName,
          scheduled_date: match.scheduledDate,
          scheduled_time: match.scheduledTime,
          court: match.court,
          player1_name: match.player1Name,
          player1_name_2: match.player1Name2,
          player2_name: match.player2Name,
          player2_name_2: match.player2Name2,
          result: match.result,
          status: match.status,
          winner_side: match.winnerSide,
          sort_order: index,
          updated_at: importedAt,
          result_seen_at: computeResultSeen(previous, match.result, importedAt),
        };
        if (!previous) {
          insertMatch.run(params);
        } else if (matchChanged(previous, params) || (previous.result_seen_at ?? null) !== params.result_seen_at) {
          updateMatch.run(params);
        }
        // unverändert: nichts schreiben (updated_at/result_seen_at bleiben erhalten)
      });
      insertExtras.run({
        tournament_id: tournamentId,
        event_id: event.meta.eventId,
        pools_json: JSON.stringify(event.pools),
        bracket_json: event.bracket ? JSON.stringify(event.bracket) : null,
      });
    }

    // Nicht mehr gelieferte Matches entfernen.
    for (const [key, row] of existingMatches) {
      if (!incomingKeys.has(key)) {
        deleteMatch.run(tournamentId, row.event_id, key);
      }
    }

    database
      .prepare(
        "UPDATE tournaments SET last_imported_at = ?, last_error = '', updated_at = ? WHERE swisstennis_tournament_id = ?",
      )
      .run(importedAt, importedAt, tournamentId);
  });
  run();
}

export function recordRefreshError(
  database: TcwDatabase,
  tournamentId: number,
  message: string,
): void {
  database
    .prepare("UPDATE tournaments SET last_error = ? WHERE swisstennis_tournament_id = ?")
    .run(message, tournamentId);
}

// --------------------------------------------------------------------------
// Öffentliche Aufbereitung
// --------------------------------------------------------------------------

function sideNames(name: string, name2: string | null): string[] {
  return [name, name2 ?? ""].map((value) => value.trim()).filter((value) => value !== "");
}

/**
 * Lädt alle Events eines Turniers inkl. Anmeldungen, Matches, Pools und
 * Tableau (aufbereitet für die öffentliche Anzeige) sowie den jüngsten
 * Import-Zeitpunkt.
 */
export function loadTournamentEvents(
  database: TcwDatabase,
  tournamentId: number,
): { events: TournamentEventView[]; updatedAt: string } {
  const eventRows = database
    .prepare(
      `SELECT event_id, event_name, discipline, sort_order, updated_at
       FROM tournament_events WHERE tournament_id = ? ORDER BY sort_order ASC`,
    )
    .all(tournamentId) as Array<{
    event_id: number;
    event_name: string;
    discipline: string;
    sort_order: number;
    updated_at: string;
  }>;

  let latestUpdate = "";
  const events: TournamentEventView[] = eventRows.map((eventRow) => {
    latestUpdate = eventRow.updated_at > latestUpdate ? eventRow.updated_at : latestUpdate;
    const players = database
      .prepare(
        `SELECT player_key, player_name, player_name_2, ranking, ranking_2, player_url, player_url_2, confirmed, registered_on, note
         FROM tournament_players WHERE tournament_id = ? AND event_id = ? ORDER BY sort_order ASC`,
      )
      .all(tournamentId, eventRow.event_id) as Array<Record<string, unknown>>;
    const matches = database
      .prepare(
        `SELECT * FROM tournament_matches WHERE tournament_id = ? AND event_id = ? ORDER BY sort_order ASC`,
      )
      .all(tournamentId, eventRow.event_id) as Array<Record<string, unknown>>;
    const extras = database
      .prepare(
        `SELECT pools_json, bracket_json FROM tournament_event_extras
         WHERE tournament_id = ? AND event_id = ?`,
      )
      .get(tournamentId, eventRow.event_id) as
      | { pools_json?: string; bracket_json?: string | null }
      | undefined;

    return {
      eventId: eventRow.event_id,
      eventName: eventRow.event_name,
      discipline: (eventRow.discipline || disciplineOf(eventRow.event_name)) as Discipline | "",
      sortOrder: eventRow.sort_order,
      players: players.map(toRegistrationPlayer),
      matches: matches.map(toTournamentMatch),
      pools: parsePools(extras?.pools_json),
      bracket: parseBracket(extras?.bracket_json),
    };
  });

  return { events, updatedAt: latestUpdate };
}

export function getPublicTournaments(database: TcwDatabase): TournamentsResponse {
  const configs = readTournamentConfigs(database, true);
  const tournaments: TournamentView[] = configs.map((config) => {
    const tournamentId = config.swisstennisTournamentId;
    const { events, updatedAt } = loadTournamentEvents(database, tournamentId);
    return {
      id: tournamentId,
      name: config.name,
      registrationUrl: config.registrationUrl,
      updatedAt,
      showsMatches: events.some((event) => event.matches.length > 0),
      events,
    };
  });

  return { tournaments };
}

function toRegistrationPlayer(row: Record<string, unknown>): RegistrationPlayer {
  return {
    playerKey: String(row.player_key),
    name: String(row.player_name ?? ""),
    name2: String(row.player_name_2 ?? ""),
    ranking: String(row.ranking ?? ""),
    ranking2: String(row.ranking_2 ?? ""),
    playerUrl: String(row.player_url ?? ""),
    playerUrl2: String(row.player_url_2 ?? ""),
    confirmed: row.confirmed === 1,
    registeredOn: String(row.registered_on ?? ""),
    note: String(row.note ?? ""),
  };
}

function parsePools(json: string | undefined): PoolStanding[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as PoolStanding[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseBracket(json: string | null | undefined): TournamentBracket | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as TournamentBracket;
  } catch {
    return null;
  }
}

function toTournamentMatch(row: Record<string, unknown>): TournamentMatch {
  return {
    matchKey: String(row.match_key),
    eventId: Number(row.event_id),
    eventName: String(row.event_name ?? ""),
    mode: String(row.mode ?? ""),
    poolName: String(row.pool_name ?? ""),
    roundName: String(row.round_name ?? ""),
    scheduledDate: String(row.scheduled_date ?? ""),
    scheduledTime: String(row.scheduled_time ?? ""),
    court: String(row.court ?? ""),
    side1Names: sideNames(String(row.player1_name ?? ""), row.player1_name_2 as string | null),
    side2Names: sideNames(String(row.player2_name ?? ""), row.player2_name_2 as string | null),
    result: String(row.result ?? ""),
    status: String(row.status ?? "open") as TournamentMatchStatus,
    winnerSide: Number(row.winner_side ?? 0),
  };
}
