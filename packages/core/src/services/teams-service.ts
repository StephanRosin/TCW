/**
 * Aufbau der öffentlichen Team- und Spielerliste aus der Datenbank.
 */
import {
  comparePlayers,
  compareTeamsWithinGender,
  safeExternalUrl,
  type CaptainStatus,
  type Gender,
  type PublicPlayer,
  type PublicTeam,
  type PublicTeamsResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

interface TeamRow {
  id: number;
  gender: string;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
}

interface PlayerRow {
  id: number;
  name: string;
  klassierung: string | null;
  profile_url: string | null;
  team_id: number;
  captain_status: number;
}

function buildTeamTitle(gender: string, category: string, liga: string): string {
  return `${gender} ${category} ${liga}`.replace(/\s+/g, " ").trim();
}

function toPublicPlayer(row: PlayerRow): PublicPlayer {
  return {
    id: row.id,
    name: row.name,
    klassierung: row.klassierung ?? "",
    myTennisUrl: safeExternalUrl(row.profile_url),
    captainStatus: row.captain_status as CaptainStatus,
  };
}

export function getPublicTeams(database: TcwDatabase): PublicTeamsResponse {
  const teamRows = database
    .prepare("SELECT id, gender, category, liga, teamziel, trainingstag FROM teams")
    .all() as TeamRow[];
  // Klassierung + Profil-URL kommen aus dem zentralen Register, nicht mehr aus
  // den (noch vorhandenen, aber veralteten) players-Spalten klassierung/myTennisID.
  const playerRows = database
    .prepare(
      `SELECT p.id, p.name, r.klassierung AS klassierung, r.profile_url AS profile_url,
              p.team_id, p.captain_status
         FROM players p
         LEFT JOIN player_registry r ON r.id = p.registry_id`,
    )
    .all() as PlayerRow[];

  const playersByTeam = new Map<number, PublicPlayer[]>();
  for (const row of playerRows) {
    const list = playersByTeam.get(row.team_id) ?? [];
    list.push(toPublicPlayer(row));
    playersByTeam.set(row.team_id, list);
  }

  const teams: PublicTeam[] = teamRows.map((row) => {
    const players = (playersByTeam.get(row.id) ?? []).sort(comparePlayers);
    return {
      id: row.id,
      title: buildTeamTitle(row.gender, row.category, row.liga),
      gender: row.gender as Gender,
      category: row.category,
      liga: row.liga,
      teamziel: row.teamziel,
      trainingstag: row.trainingstag,
      players,
    };
  });

  const damen = teams.filter((team) => team.gender === "Damen").sort(compareTeamsWithinGender);
  const herren = teams.filter((team) => team.gender === "Herren").sort(compareTeamsWithinGender);
  return { damen, herren };
}
