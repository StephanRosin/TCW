/**
 * Übernimmt die BESTÄTIGTEN Spieltermine aus der CM-Platz-App (separate SQLite-
 * DB `cm.db`, Tabelle `court_requests`) in die Clubmeisterschafts-Matches.
 *
 * Hintergrund: Swisstennis liefert für die CM nur ein „zu spielen bis"-Datum,
 * kein echtes Spieldatum. In der CM-Platz-App reservieren die Spieler:innen
 * Plätze; bestätigte Reservationen (`status = 'bestätigt'`) tragen das echte
 * Datum/Uhrzeit/Platz. Diese werden hier auf die offenen CM-Partien geschrieben
 * – in `tournament_matches` (Matchliste + Round-robin) und im `bracket_json`
 * (Tableau). Läuft NACH dem Swisstennis-Import (der die Termine zurücksetzt) und
 * wird bei jedem Import erneut angewandt. Gespielte Partien bleiben unberührt.
 *
 * Zuordnung über die Swisstennis-IDs: `court_requests.event_id` = TCW-event_id;
 * `match_id` ist entweder die Round-robin-Match-ID (→ `rr:<event>:<id>`) oder
 * "Level_Position" für Tableau-Partien (→ `draw:<event>:<level>:<position>`).
 */
import Database from "better-sqlite3";
import type { TournamentBracket } from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";

const DRAW_MATCH_ID = /^(\d+)_(\d+)$/;
const REQ_DATETIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

export interface CmReservation {
  tournamentId: number;
  eventId: number;
  matchKey: string;
  /** Draw-Partie? Dann sind level/position gesetzt (fürs Tableau). */
  isDraw: boolean;
  level: number;
  position: number;
  date: string;
  time: string;
  court: string;
}

export interface CmReservationApplyResult {
  reservations: number;
  matchesUpdated: number;
  bracketNodesUpdated: number;
}

/** Für die Zuordnung relevante Spalten der `court_requests`-Zeile. */
export interface CourtRequestRow {
  tournament_id: number;
  event_id: number;
  match_id: string;
  req_datetime: string | null;
  court_nb: number | null;
}

/**
 * Wandelt eine `court_requests`-Zeile in eine CmReservation um. Gibt `null`
 * zurück, wenn kein gültiger Termin gesetzt ist. Exportiert für Tests.
 */
export function mapCourtRequestToReservation(row: CourtRequestRow): CmReservation | null {
  const time = REQ_DATETIME.exec(row.req_datetime ?? "");
  if (!time) return null;
  const draw = DRAW_MATCH_ID.exec(String(row.match_id));
  const eventId = row.event_id;
  const court = row.court_nb != null ? `Platz ${row.court_nb}` : "";
  const base = {
    tournamentId: row.tournament_id,
    eventId,
    date: time[1]!,
    time: time[2]!,
    court,
  };
  if (draw) {
    const level = Number(draw[1]);
    const position = Number(draw[2]);
    return { ...base, matchKey: `draw:${eventId}:${level}:${position}`, isDraw: true, level, position };
  }
  return { ...base, matchKey: `rr:${eventId}:${row.match_id}`, isDraw: false, level: -1, position: -1 };
}

/** Liest die bestätigten Reservationen (mit gültigem Termin) aus der cm.db. */
export function readConfirmedCmReservations(cmDbPath: string): CmReservation[] {
  const db = new Database(cmDbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `SELECT tournament_id, event_id, match_id, req_datetime, court_nb
         FROM court_requests WHERE status = 'bestätigt'`,
      )
      .all() as CourtRequestRow[];
    const reservations: CmReservation[] = [];
    for (const row of rows) {
      const reservation = mapCourtRequestToReservation(row);
      if (reservation) reservations.push(reservation);
    }
    return reservations;
  } finally {
    db.close();
  }
}

/** Setzt die Termine der Draw-Reservationen eines Events im bracket_json. */
function applyToBracket(
  database: TcwDatabase,
  tournamentId: number,
  eventId: number,
  draws: CmReservation[],
): number {
  const row = database
    .prepare(
      `SELECT bracket_json FROM tournament_event_extras WHERE tournament_id = ? AND event_id = ?`,
    )
    .get(tournamentId, eventId) as { bracket_json: string | null } | undefined;
  if (!row?.bracket_json) return 0;
  const bracket = JSON.parse(row.bracket_json) as TournamentBracket;
  let changed = 0;
  for (const reservation of draws) {
    // rounds werden für level = maxLevel-1 … 0 gebaut → roundIndex = len-1-level.
    const round = bracket.rounds[bracket.rounds.length - 1 - reservation.level];
    const node = round?.matches[reservation.position];
    if (!node) continue;
    // Gespielte Partien nicht anfassen (haben ein Ergebnis) – analog zu status='open'.
    if (node.result.trim() !== "" || node.winnerSide > 0) continue;
    node.scheduledDate = reservation.date;
    node.scheduledTime = reservation.time;
    node.court = reservation.court;
    changed += 1;
  }
  if (changed > 0) {
    database
      .prepare(`UPDATE tournament_event_extras SET bracket_json = ? WHERE tournament_id = ? AND event_id = ?`)
      .run(JSON.stringify(bracket), tournamentId, eventId);
  }
  return changed;
}

/**
 * Schreibt eine Liste von Reservationen auf die offenen CM-Partien: Termin/Platz
 * in `tournament_matches` und – für Draw-Partien – zusätzlich ins `bracket_json`.
 * Reine DB-Operation (ohne cm.db-Zugriff), damit gut testbar.
 */
export function applyReservations(database: TcwDatabase, reservations: CmReservation[]): CmReservationApplyResult {
  const updateMatch = database.prepare(
    `UPDATE tournament_matches
     SET scheduled_date = @date, scheduled_time = @time, court = @court, updated_at = @at
     WHERE tournament_id = @tournamentId AND event_id = @eventId AND match_key = @matchKey AND status = 'open'`,
  );
  const at = new Date().toISOString();
  let matchesUpdated = 0;
  let bracketNodesUpdated = 0;

  const run = database.transaction(() => {
    for (const reservation of reservations) {
      matchesUpdated += updateMatch.run({
        tournamentId: reservation.tournamentId,
        eventId: reservation.eventId,
        matchKey: reservation.matchKey,
        date: reservation.date,
        time: reservation.time,
        court: reservation.court,
        at,
      }).changes;
    }
    // Draw-Reservationen je Event bündeln und ins bracket_json übertragen.
    const drawsByEvent = new Map<string, { tournamentId: number; eventId: number; draws: CmReservation[] }>();
    for (const reservation of reservations) {
      if (!reservation.isDraw) continue;
      const key = `${reservation.tournamentId}:${reservation.eventId}`;
      const group = drawsByEvent.get(key) ?? {
        tournamentId: reservation.tournamentId,
        eventId: reservation.eventId,
        draws: [],
      };
      group.draws.push(reservation);
      drawsByEvent.set(key, group);
    }
    for (const group of drawsByEvent.values()) {
      bracketNodesUpdated += applyToBracket(database, group.tournamentId, group.eventId, group.draws);
    }
  });
  run();
  return { reservations: reservations.length, matchesUpdated, bracketNodesUpdated };
}

/**
 * Liest die bestätigten CM-Termine aus der cm.db und schreibt sie auf die
 * offenen CM-Partien (siehe {@link applyReservations}). Ist `cmDbPath` leer,
 * passiert nichts.
 */
export function applyCmReservationDates(database: TcwDatabase, cmDbPath: string): CmReservationApplyResult {
  if (cmDbPath.trim() === "") return { reservations: 0, matchesUpdated: 0, bracketNodesUpdated: 0 };
  return applyReservations(database, readConfirmedCmReservations(cmDbPath));
}
