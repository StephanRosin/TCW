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
  klassierung: string;
  myTennisID: string;
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
    klassierung: row.klassierung,
    myTennisUrl: safeExternalUrl(row.myTennisID),
    captainStatus: row.captain_status as CaptainStatus,
  };
}

export function getPublicTeams(database: TcwDatabase): PublicTeamsResponse {
  const teamRows = database
    .prepare("SELECT id, gender, category, liga, teamziel, trainingstag FROM teams")
    .all() as TeamRow[];
  const playerRows = database
    .prepare("SELECT id, name, klassierung, myTennisID, team_id, captain_status FROM players")
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
