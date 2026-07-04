/**
 * Admin-CRUD für Spieler. Klassierung und die numerische mytennis-ID werden
 * ausschliesslich übers zentrale Register (`player_registry`) gelesen und
 * geschrieben; die players-Spalten `klassierung`/`myTennisID` werden nicht mehr
 * angefasst (Drop folgt in Task 6).
 */
import {
  comparePlayers,
  compareTeamsWithinGender,
  genderRank,
  myTennisUrlFromId,
  type AdminPlayer,
  type CaptainStatus,
} from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";
import { runDatabaseWrite, ValidationError } from "./errors.js";
import { enrichPlayer, syncPlayerToRegistry, linkPlayerRegistryId } from "./enrich.js";

export interface PlayerInput {
  name: string;
  klassierung: string;
  mytennisId: string;
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
    // Numerische mytennis-ID (keine URL); myTennisUrlFromId verwirft Nicht-Numerisches.
    mytennisId: String(input.mytennisId ?? "").trim(),
    team_id: teamId,
    captain_status: captainStatus,
  };
}

interface PlayerRow {
  id: number;
  name: string;
  klassierung: string | null;
  mytennisId: string | null;
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
    klassierung: row.klassierung ?? "",
    mytennisId: row.mytennisId ?? "",
    teamId: row.team_id,
    captainStatus: row.captain_status as CaptainStatus,
    teamDisplay: `${row.team_gender} ${row.team_category} ${row.team_liga}`.replace(/\s+/g, " ").trim(),
  };
}

export function listPlayers(database: TcwDatabase): AdminPlayer[] {
  const rows = database
    .prepare(
      `SELECT p.id, p.name, r.klassierung AS klassierung, r.mytennis_id AS mytennisId,
              p.team_id, p.captain_status,
              t.gender AS team_gender, t.category AS team_category, t.liga AS team_liga
       FROM players p
       INNER JOIN teams t ON t.id = p.team_id
       LEFT JOIN player_registry r ON r.id = p.registry_id`,
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

/** Sorgt dafür, dass der Kaderspieler als Mitglied im Register steht (auch ohne URL)
 *  und players.registry_id gesetzt ist. Ohne ID wird per Namenssuche angereichert. */
async function syncRosterIdentity(
  database: TcwDatabase,
  playerId: number,
  input: { name: string; klassierung: string; mytennisId: string },
  myTennisTimeoutMs: number,
): Promise<void> {
  const url = myTennisUrlFromId(input.mytennisId);
  // Immer als Mitglied ins Register (auch ohne URL → name-only Mitglied) + harter FK.
  const regId = syncPlayerToRegistry(database, {
    name: input.name,
    klassierung: input.klassierung.trim() === "" ? null : input.klassierung,
    myTennisID: url,
  });
  linkPlayerRegistryId(database, playerId, regId);
  // Keine ID gepflegt → per Namenssuche URL + Klassierung ergänzen (schreibt ins Register).
  if (!url) await enrichPlayer(database, playerId, myTennisTimeoutMs);
}

export async function createPlayer(
  database: TcwDatabase,
  input: Partial<PlayerInput>,
  myTennisTimeoutMs: number,
): Promise<void> {
  const player = validatePlayer(input);
  // INSERT ohne klassierung/myTennisID — diese leben ausschliesslich im Register.
  const playerId = runDatabaseWrite(() =>
    Number(
      database
        .prepare(
          "INSERT INTO players (name, team_id, captain_status) VALUES (@name, @team_id, @captain_status)",
        )
        .run(player).lastInsertRowid,
    ),
  );
  await syncRosterIdentity(database, playerId, player, myTennisTimeoutMs);
}

export async function updatePlayer(
  database: TcwDatabase,
  id: number,
  input: Partial<PlayerInput>,
  myTennisTimeoutMs: number,
): Promise<void> {
  const player = validatePlayer(input);
  runDatabaseWrite(() =>
    database
      .prepare(
        "UPDATE players SET name = @name, team_id = @team_id, captain_status = @captain_status WHERE id = @id",
      )
      .run({ name: player.name, team_id: player.team_id, captain_status: player.captain_status, id }),
  );
  await syncRosterIdentity(database, id, player, myTennisTimeoutMs);
}

export function deletePlayer(database: TcwDatabase, id: number): void {
  database.prepare("DELETE FROM players WHERE id = ?").run(id);
}
