/**
 * Admin-Verwaltung der Turnierkonfiguration. Anmeldelink und Kategorien werden
 * nicht manuell gepflegt; sie ergeben sich aus der Turnier-ID bzw. Swisstennis.
 */
import { registrationUrlForId, type AdminTournament } from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";
import { runDatabaseWrite, ValidationError } from "./errors.js";

export interface TournamentInput {
  name: string;
  swisstennis_tournament_id: number;
  active?: number | boolean;
  sort_order?: number;
}

interface TournamentRow {
  id: number;
  name: string;
  swisstennis_tournament_id: number;
  registration_url: string | null;
  active: number;
  sort_order: number;
  last_imported_at: string;
  last_error: string;
}

export function listAdminTournaments(database: TcwDatabase): AdminTournament[] {
  const rows = database
    .prepare(
      `SELECT id, name, swisstennis_tournament_id, registration_url, active, sort_order, last_imported_at, last_error
       FROM tournaments ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC`,
    )
    .all() as TournamentRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    swisstennisTournamentId: row.swisstennis_tournament_id,
    registrationUrl: row.registration_url ?? registrationUrlForId(row.swisstennis_tournament_id),
    active: row.active === 1,
    sortOrder: row.sort_order,
    updatedAt: row.last_imported_at,
    lastError: row.last_error,
  }));
}

interface NormalizedTournament {
  name: string;
  swisstennisTournamentId: number;
  active: number;
  sortOrder: number;
}

function validateTournaments(items: unknown): NormalizedTournament[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Mindestens ein Turnier ist erforderlich.");
  }
  const normalized = items.map((raw, index) => {
    const item = raw as Partial<TournamentInput>;
    const name = String(item.name ?? "").trim();
    if (name === "") {
      throw new ValidationError("Jedes Turnier braucht einen Namen.");
    }
    const swisstennisTournamentId = Number(item.swisstennis_tournament_id);
    if (!Number.isInteger(swisstennisTournamentId) || swisstennisTournamentId <= 0) {
      throw new ValidationError("Jedes Turnier braucht eine gültige SwissTennis Turnier-ID.");
    }
    const sortOrder = Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : index;
    const active = Number(item.active) === 0 ? 0 : 1;
    return { name, swisstennisTournamentId, active, sortOrder };
  });

  const ids = new Set<number>();
  for (const item of normalized) {
    if (ids.has(item.swisstennisTournamentId)) {
      throw new ValidationError("SwissTennis Turnier-IDs dürfen nicht doppelt vorkommen.");
    }
    ids.add(item.swisstennisTournamentId);
  }
  return normalized;
}

/** Ersetzt die Turnierkonfiguration; verwaiste Importdaten werden entfernt. */
export function saveTournaments(database: TcwDatabase, items: unknown): void {
  const tournaments = validateTournaments(items);
  const upsert = database.prepare(
    `INSERT INTO tournaments (name, swisstennis_tournament_id, registration_url, active, sort_order, updated_at)
     VALUES (@name, @id, @url, @active, @sortOrder, datetime('now'))
     ON CONFLICT(swisstennis_tournament_id) DO UPDATE SET
       name = excluded.name, registration_url = excluded.registration_url,
       active = excluded.active, sort_order = excluded.sort_order, updated_at = datetime('now')`,
  );
  const keptIds = tournaments.map((tournament) => tournament.swisstennisTournamentId);
  const placeholders = keptIds.map(() => "?").join(",");

  runDatabaseWrite(() =>
    database.transaction(() => {
    for (const tournament of tournaments) {
      upsert.run({
        name: tournament.name,
        id: tournament.swisstennisTournamentId,
        url: registrationUrlForId(tournament.swisstennisTournamentId),
        active: tournament.active,
        sortOrder: tournament.sortOrder,
      });
    }
    for (const table of ["tournament_players", "tournament_matches", "tournament_events"]) {
      database.prepare(`DELETE FROM ${table} WHERE tournament_id NOT IN (${placeholders})`).run(...keptIds);
    }
      database.prepare(`DELETE FROM tournaments WHERE swisstennis_tournament_id NOT IN (${placeholders})`).run(...keptIds);
    })(),
  );
}
