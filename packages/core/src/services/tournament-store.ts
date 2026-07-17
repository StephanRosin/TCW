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
import { upsertPlayer } from "./player-registry.js";

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

/** Ein an eine SQLite-Prepared-Statement-Spalte bindbarer Wert. */
type SqlValue = string | number | null;

/** Ob sich ein inhaltliches Feld gegenüber dem gespeicherten Stand geändert hat. */
function matchChanged(previous: ExistingMatchRow, next: Record<string, unknown>): boolean {
  for (const field of MATCH_TEXT_FIELDS) {
    if (String(previous[field] ?? "") !== String((next[field] as SqlValue) ?? "")) return true;
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

/* --- Geteilte Match-Statements/Params (von replaceTournamentData UND dem
   gezielten Order-of-Play-Upsert genutzt, damit die SQL nur einmal existiert) --- */

const SELECT_MATCHES_SQL = `SELECT match_key, event_id, tournament_name, event_name, mode, pool_name, round_name,
        scheduled_date, scheduled_time, court, player1_name, player1_name_2, player2_name,
        player2_name_2, result, status, winner_side, sort_order, result_seen_at
 FROM tournament_matches WHERE tournament_id = ?`;

const INSERT_MATCH_SQL = `INSERT INTO tournament_matches (tournament_id, event_id, match_key, tournament_name, event_name, mode, pool_name, round_name, scheduled_date, scheduled_time, court, player1_name, player1_name_2, player2_name, player2_name_2, result, status, winner_side, sort_order, updated_at, result_seen_at)
     VALUES (@tournament_id, @event_id, @match_key, @tournament_name, @event_name, @mode, @pool_name, @round_name, @scheduled_date, @scheduled_time, @court, @player1_name, @player1_name_2, @player2_name, @player2_name_2, @result, @status, @winner_side, @sort_order, @updated_at, @result_seen_at)`;

const UPDATE_MATCH_SQL = `UPDATE tournament_matches SET tournament_name=@tournament_name, event_name=@event_name, mode=@mode,
        pool_name=@pool_name, round_name=@round_name, scheduled_date=@scheduled_date,
        scheduled_time=@scheduled_time, court=@court, player1_name=@player1_name,
        player1_name_2=@player1_name_2, player2_name=@player2_name, player2_name_2=@player2_name_2,
        result=@result, status=@status, winner_side=@winner_side, sort_order=@sort_order,
        updated_at=@updated_at, result_seen_at=@result_seen_at
 WHERE tournament_id=@tournament_id AND event_id=@event_id AND match_key=@match_key`;

const DELETE_MATCH_SQL =
  "DELETE FROM tournament_matches WHERE tournament_id = ? AND event_id = ? AND match_key = ?";

function prepareMatchStatements(database: TcwDatabase) {
  return {
    selectExisting: database.prepare(SELECT_MATCHES_SQL),
    insertMatch: database.prepare(INSERT_MATCH_SQL),
    updateMatch: database.prepare(UPDATE_MATCH_SQL),
    deleteMatch: database.prepare(DELETE_MATCH_SQL),
  };
}

/** Baut die (benannten) Parameter für Insert/Update einer Match-Zeile. */
function buildMatchParams(
  tournamentId: number,
  tournamentName: string,
  match: MatchRecord,
  previous: ExistingMatchRow | undefined,
  sortOrder: number,
  importedAt: string,
): Record<string, SqlValue> {
  // Gespielte Partien behalten ihren zuletzt bekannten Termin, falls Swisstennis
  // ihn nach dem Spiel entfernt (z. B. bei W/O den Platz/die Zeit): sonst würden
  // sie mangels Termin aus dem Order of Play verschwinden, statt dort mit
  // Ergebnis an ihrem Slot sichtbar zu bleiben.
  const played = match.result.trim() !== "" || match.status === "played";
  const keepIfPlayed = (incoming: string, previousValue: string | null | undefined): string =>
    incoming !== "" ? incoming : played ? (previousValue ?? "") : incoming;
  return {
    tournament_id: tournamentId,
    event_id: match.eventId,
    match_key: match.matchKey,
    tournament_name: tournamentName,
    event_name: match.eventName,
    mode: match.mode,
    pool_name: match.poolName,
    round_name: match.roundName,
    scheduled_date: keepIfPlayed(match.scheduledDate, previous?.scheduled_date),
    scheduled_time: keepIfPlayed(match.scheduledTime, previous?.scheduled_time),
    court: keepIfPlayed(match.court, previous?.court),
    player1_name: match.player1Name,
    player1_name_2: match.player1Name2,
    player2_name: match.player2Name,
    player2_name_2: match.player2Name2,
    result: match.result,
    status: match.status,
    winner_side: match.winnerSide,
    sort_order: sortOrder,
    updated_at: importedAt,
    result_seen_at: computeResultSeen(previous, match.result, importedAt),
  };
}

/** Ob eine Match-Zeile geschrieben werden muss (neu oder inhaltlich geändert). */
function matchNeedsWrite(
  previous: ExistingMatchRow | undefined,
  params: Record<string, SqlValue>,
): boolean {
  return (
    !previous ||
    matchChanged(previous, params) ||
    (previous.result_seen_at ?? null) !== params.result_seen_at
  );
}

/**
 * Gezielter Sofort-Update einzelner Match-Zeilen (Termin + Ergebnis) OHNE die
 * übrigen Importdaten anzufassen: nur die übergebenen Matches werden per
 * (tournament_id, event_id, match_key) upgesertet, es wird nichts gelöscht und
 * keine Player/Events/Extras berührt. Für den Order-of-Play-Sofort-Refresh.
 * Gibt die Anzahl tatsächlich geschriebener Zeilen zurück.
 */
export function upsertScheduledMatches(
  database: TcwDatabase,
  tournamentId: number,
  tournamentName: string,
  matches: MatchRecord[],
  importedAt: string,
): number {
  const { selectExisting, insertMatch, updateMatch } = prepareMatchStatements(database);
  let written = 0;
  const run = database.transaction(() => {
    const existing = new Map<string, ExistingMatchRow>();
    for (const row of selectExisting.all(tournamentId) as ExistingMatchRow[]) {
      existing.set(row.match_key, row);
    }
    for (const match of matches) {
      const previous = existing.get(match.matchKey);
      // Bestehende Reihenfolge beibehalten (kein Reordering bei gezieltem Update).
      const params = buildMatchParams(
        tournamentId,
        tournamentName,
        match,
        previous,
        previous?.sort_order ?? 0,
        importedAt,
      );
      if (!previous) {
        insertMatch.run(params);
        written += 1;
      } else if (matchNeedsWrite(previous, params)) {
        updateMatch.run(params);
        written += 1;
      }
    }
  });
  run();
  return written;
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
    `INSERT OR IGNORE INTO tournament_players (tournament_id, event_id, player_key, player_name, player_name_2, license_number, license_number_2, player_url, player_url_2, confirmed, registered_on, note, sort_order)
     VALUES (@tournament_id, @event_id, @player_key, @player_name, @player_name_2, @license_number, @license_number_2, @player_url, @player_url_2, @confirmed, @registered_on, @note, @sort_order_player)`,
  );
  const {
    selectExisting: selectExistingMatches,
    insertMatch,
    updateMatch,
    deleteMatch,
  } = prepareMatchStatements(database);

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

    const syncPlayer = (event: EventImport, player: EventImport["registrations"][number]): void => {
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
        registered_on: player.registeredOn,
        sort_order_player: player.sortOrder,
        note: player.note,
      });

      // Turnier-Import spiegelt beide Doppel-Spieler als Nicht-Mitglieder ins
      // zentrale Register (kein Datenverlust, kein member-Flag) und verknüpft
      // tournament_players weich (kein FK) mit der so entstandenen Register-Zeile.
      const regId = upsertPlayer(database, {
        name: player.playerName,
        url: player.playerUrl,
        license: player.licenseNumber,
        klassierung: player.ranking,
      });
      let regId2 = 0;
      if (player.playerName2) {
        regId2 = upsertPlayer(database, {
          name: player.playerName2,
          url: player.playerUrl2,
          license: player.licenseNumber2,
          klassierung: player.ranking2,
        });
      }
      if (regId > 0 || regId2 > 0) {
        database
          .prepare(
            "UPDATE tournament_players SET registry_id = ?, registry_id_2 = ? WHERE tournament_id = ? AND event_id = ? AND player_key = ?",
          )
          .run(regId > 0 ? regId : null, regId2 > 0 ? regId2 : null, tournamentId, event.meta.eventId, player.playerKey);
      }
    };

    const syncMatch = (match: EventImport["matches"][number], index: number): void => {
      incomingKeys.add(match.matchKey);
      const previous = existingMatches.get(match.matchKey);
      const params = buildMatchParams(tournamentId, tournamentName, match, previous, index, importedAt);
      if (!previous) {
        insertMatch.run(params);
      } else if (matchNeedsWrite(previous, params)) {
        updateMatch.run(params);
      }
      // unverändert: nichts schreiben (updated_at/result_seen_at bleiben erhalten)
    };

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
        syncPlayer(event, player);
      }
      event.matches.forEach((match, index) => syncMatch(match, index));
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

/**
 * match_keys aller Matches eines Turniers, die aktuell auf einen der `dates`
 * ("YYYY-MM-DD") terminiert sind. Für den Order-of-Play-Refresh, damit eine
 * gespielte Partie (die ihren Termin verloren hat) trotzdem aktualisiert wird.
 */
export function readScheduledMatchKeys(
  database: TcwDatabase,
  tournamentId: number,
  dates: string[],
): Set<string> {
  if (dates.length === 0) return new Set();
  const placeholders = dates.map(() => "?").join(",");
  const rows = database
    .prepare(
      `SELECT match_key FROM tournament_matches WHERE tournament_id = ? AND scheduled_date IN (${placeholders})`,
    )
    .all(tournamentId, ...dates) as Array<{ match_key: string }>;
  return new Set(rows.map((row) => row.match_key));
}

/** Anzahl der aktuell gespeicherten Matches eines Turniers. */
export function countTournamentMatches(database: TcwDatabase, tournamentId: number): number {
  const row = database
    .prepare("SELECT COUNT(*) AS n FROM tournament_matches WHERE tournament_id = ?")
    .get(tournamentId) as { n: number };
  return row.n;
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
    // ranking/ranking_2 kommen aus dem zentralen Register (aktuelle Klassierung),
    // nicht mehr aus dem Import-Snapshot in tournament_players. LEFT JOIN, damit
    // eine (noch) fehlende Verknüpfung (registry_id NULL) die Registrierung nicht
    // aus der Liste wirft – die Klassierung ist dann einfach leer.
    const players = database
      .prepare(
        `SELECT tp.player_key, tp.player_name, tp.player_name_2,
                r.klassierung  AS ranking,
                r2.klassierung AS ranking_2,
                tp.player_url, tp.player_url_2, tp.confirmed, tp.registered_on, tp.note
         FROM tournament_players tp
         LEFT JOIN player_registry r  ON r.id  = tp.registry_id
         LEFT JOIN player_registry r2 ON r2.id = tp.registry_id_2
         WHERE tp.tournament_id = ? AND tp.event_id = ? ORDER BY tp.sort_order ASC`,
      )
      .all(tournamentId, eventRow.event_id) as RegistrationPlayerRow[];
    const matches = database
      .prepare(
        `SELECT * FROM tournament_matches WHERE tournament_id = ? AND event_id = ? ORDER BY sort_order ASC`,
      )
      .all(tournamentId, eventRow.event_id) as TournamentMatchRow[];
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

interface RegistrationPlayerRow {
  player_key: string;
  player_name: string | null;
  player_name_2: string | null;
  ranking: string | null;
  ranking_2: string | null;
  player_url: string | null;
  player_url_2: string | null;
  confirmed: number;
  registered_on: string | null;
  note: string | null;
}

function toRegistrationPlayer(row: RegistrationPlayerRow): RegistrationPlayer {
  return {
    playerKey: row.player_key,
    name: row.player_name ?? "",
    name2: row.player_name_2 ?? "",
    ranking: row.ranking ?? "",
    ranking2: row.ranking_2 ?? "",
    playerUrl: row.player_url ?? "",
    playerUrl2: row.player_url_2 ?? "",
    confirmed: row.confirmed === 1,
    registeredOn: row.registered_on ?? "",
    note: row.note ?? "",
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

interface TournamentMatchRow {
  match_key: string;
  event_id: number;
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
}

function toTournamentMatch(row: TournamentMatchRow): TournamentMatch {
  return {
    matchKey: row.match_key,
    eventId: row.event_id,
    eventName: row.event_name ?? "",
    mode: row.mode ?? "",
    poolName: row.pool_name ?? "",
    roundName: row.round_name ?? "",
    scheduledDate: row.scheduled_date ?? "",
    scheduledTime: row.scheduled_time ?? "",
    court: row.court ?? "",
    side1Names: sideNames(row.player1_name ?? "", row.player1_name_2),
    side2Names: sideNames(row.player2_name ?? "", row.player2_name_2),
    result: row.result ?? "",
    status: (row.status ?? "open") as TournamentMatchStatus,
    winnerSide: row.winner_side ?? 0,
  };
}
