/**
 * Admin-CRUD für Spieler inklusive automatischer MyTennis-Suche bei neuen
 * Spielern und bei Namensänderungen (dann Klassierung/URL vorher leeren).
 */
import {
  comparePlayers,
  compareTeamsWithinGender,
  genderRank,
  type AdminPlayer,
  type CaptainStatus,
} from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";
import { runDatabaseWrite, ValidationError } from "./errors.js";
import { enrichPlayer } from "./enrich.js";

export interface PlayerInput {
  name: string;
  klassierung: string;
  myTennisID: string;
  team_id: number;
  captain_status: number;
}

function validatePlayer(input: Partial<PlayerInput>): PlayerInput {
  if (String(input.name ?? "").trim() === "") {
    throw new ValidationError("Feld 'name' ist erforderlich.");
  }
  const teamId = Number(input.team_id);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    throw new ValidationError("team_id ist ungültig.");
  }
  const captainStatus = Number(input.captain_status);
  if (!Number.isInteger(captainStatus)) {
    throw new ValidationError("captain_status ist ungültig.");
  }
  if (![0, 1, 2].includes(captainStatus)) {
    throw new ValidationError("captain_status muss 0, 1 oder 2 sein.");
  }
  return {
    name: String(input.name).trim(),
    klassierung: String(input.klassierung ?? "").trim().toUpperCase(),
    myTennisID: String(input.myTennisID ?? "").trim(),
    team_id: teamId,
    captain_status: captainStatus,
  };
}

interface PlayerRow {
  id: number;
  name: string;
  klassierung: string;
  myTennisID: string;
  team_id: number;
  captain_status: number;
  team_gender: string;
  team_category: string;
  team_liga: string;
}

function toAdminPlayer(row: PlayerRow): AdminPlayer {
  return {
    id: row.id,
    name: row.name,
    klassierung: row.klassierung,
    myTennisID: row.myTennisID,
    teamId: row.team_id,
    captainStatus: row.captain_status as CaptainStatus,
    teamDisplay: `${row.team_gender} ${row.team_category} ${row.team_liga}`.replace(/\s+/g, " ").trim(),
  };
}

export function listPlayers(database: TcwDatabase): AdminPlayer[] {
  const rows = database
    .prepare(
      `SELECT p.id, p.name, p.klassierung, p.myTennisID, p.team_id, p.captain_status,
              t.gender AS team_gender, t.category AS team_category, t.liga AS team_liga
       FROM players p INNER JOIN teams t ON t.id = p.team_id`,
    )
    .all() as PlayerRow[];

  return rows.map(toAdminPlayer).sort((a, b) => {
    const teamA = parseTeam(a.teamDisplay);
    const teamB = parseTeam(b.teamDisplay);
    const byGender = genderRank(teamA.gender) - genderRank(teamB.gender);
    if (byGender !== 0) return byGender;
    const byTeam = compareTeamsWithinGender(teamA, teamB);
    if (byTeam !== 0) return byTeam;
    return comparePlayers(
      { captainStatus: a.captainStatus, klassierung: a.klassierung, name: a.name },
      { captainStatus: b.captainStatus, klassierung: b.klassierung, name: b.name },
    );
  });
}

function parseTeam(displayName: string): { gender: string; category: string; liga: string } {
  const [gender = "", category = "", ...rest] = displayName.split(" ");
  return { gender, category, liga: rest.join(" ") };
}

export async function createPlayer(
  database: TcwDatabase,
  input: Partial<PlayerInput>,
  myTennisTimeoutMs: number,
): Promise<void> {
  const player = validatePlayer(input);
  const playerId = runDatabaseWrite(() =>
    Number(
      database
        .prepare(
          "INSERT INTO players (name, klassierung, myTennisID, team_id, captain_status) VALUES (@name, @klassierung, @myTennisID, @team_id, @captain_status)",
        )
        .run(player).lastInsertRowid,
    ),
  );
  if (player.myTennisID === "") {
    await enrichPlayer(database, playerId, myTennisTimeoutMs);
  }
}

export async function updatePlayer(
  database: TcwDatabase,
  id: number,
  input: Partial<PlayerInput>,
  myTennisTimeoutMs: number,
): Promise<void> {
  const player = validatePlayer(input);
  const existing = database.prepare("SELECT name FROM players WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  const nameChanged = existing !== undefined && existing.name.trim() !== player.name;

  if (nameChanged) {
    runDatabaseWrite(() =>
      database
        .prepare(
          "UPDATE players SET name = @name, klassierung = '', myTennisID = '', team_id = @team_id, captain_status = @captain_status WHERE id = @id",
        )
        .run({ name: player.name, team_id: player.team_id, captain_status: player.captain_status, id }),
    );
    await enrichPlayer(database, id, myTennisTimeoutMs);
    return;
  }

  runDatabaseWrite(() =>
    database
      .prepare(
        "UPDATE players SET name = @name, klassierung = @klassierung, myTennisID = @myTennisID, team_id = @team_id, captain_status = @captain_status WHERE id = @id",
      )
      .run({ ...player, id }),
  );
}

export function deletePlayer(database: TcwDatabase, id: number): void {
  database.prepare("DELETE FROM players WHERE id = ?").run(id);
}
