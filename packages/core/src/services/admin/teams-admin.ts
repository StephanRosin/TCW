/**
 * Admin-CRUD für Teams. Der Anzeigename ergibt sich aus Geschlecht, Kategorie
 * und Liga und ist nicht editierbar.
 */
import { compareTeamsWithinGender, genderRank, type AdminTeam, type Gender } from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";
import { runDatabaseWrite, ValidationError } from "./errors.js";

export interface TeamInput {
  gender: string;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
}

const REQUIRED_FIELDS: ReadonlyArray<keyof TeamInput> = [
  "gender",
  "category",
  "liga",
  "teamziel",
  "trainingstag",
];

function validateTeam(input: Partial<TeamInput>): TeamInput {
  for (const field of REQUIRED_FIELDS) {
    if (String(input[field] ?? "").trim() === "") {
      throw new ValidationError(`Feld '${field}' ist erforderlich.`);
    }
  }
  if (input.gender !== "Damen" && input.gender !== "Herren") {
    throw new ValidationError("gender muss 'Damen' oder 'Herren' sein.");
  }
  return {
    gender: input.gender,
    category: String(input.category).trim(),
    liga: String(input.liga).trim(),
    teamziel: String(input.teamziel).trim(),
    trainingstag: String(input.trainingstag).trim(),
  };
}

interface TeamRow {
  id: number;
  gender: string;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
}

function toAdminTeam(row: TeamRow): AdminTeam {
  return {
    id: row.id,
    displayName: `${row.gender} ${row.category} ${row.liga}`.replace(/\s+/g, " ").trim(),
    gender: row.gender as Gender,
    category: row.category,
    liga: row.liga,
    teamziel: row.teamziel,
    trainingstag: row.trainingstag,
  };
}

export function listTeams(database: TcwDatabase): AdminTeam[] {
  const rows = database
    .prepare("SELECT id, gender, category, liga, teamziel, trainingstag FROM teams")
    .all() as TeamRow[];
  return rows
    .map(toAdminTeam)
    .sort((a, b) => genderRank(a.gender) - genderRank(b.gender) || compareTeamsWithinGender(a, b));
}

export function createTeam(database: TcwDatabase, input: Partial<TeamInput>): void {
  const team = validateTeam(input);
  runDatabaseWrite(() =>
    database
      .prepare(
        "INSERT INTO teams (gender, category, liga, teamziel, trainingstag) VALUES (@gender, @category, @liga, @teamziel, @trainingstag)",
      )
      .run(team),
  );
}

export function updateTeam(database: TcwDatabase, id: number, input: Partial<TeamInput>): void {
  const team = validateTeam(input);
  runDatabaseWrite(() =>
    database
      .prepare(
        "UPDATE teams SET gender = @gender, category = @category, liga = @liga, teamziel = @teamziel, trainingstag = @trainingstag WHERE id = @id",
      )
      .run({ ...team, id }),
  );
}

export function deleteTeam(database: TcwDatabase, id: number): void {
  database.prepare("DELETE FROM teams WHERE id = ?").run(id);
}
