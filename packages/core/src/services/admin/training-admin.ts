/**
 * Admin-Verwaltung der Trainingsslots als Wochenraster.
 * Gespeichert wird das gesamte Abendfenster (18:00–22:00) gesammelt.
 */
import {
  TRAINING_DAYS,
  TRAINING_WINDOW_END,
  TRAINING_WINDOW_START,
  type AdminTrainingSlot,
  type TrainingDay,
} from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";
import { runDatabaseWrite, ValidationError } from "./errors.js";

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MIN_COURT = 1;
const MAX_COURT = 4;

export interface GridItem {
  day: string;
  time_from: string;
  time_to: string;
  court_number: number;
  team_id?: number | string | null;
  label_override?: string;
}

interface SlotRow {
  id: number;
  day: string;
  time_from: string;
  time_to: string;
  court_number: number;
  team_id: number | null;
  label_override: string;
  display_label: string;
}

export function listTrainingSlots(database: TcwDatabase): AdminTrainingSlot[] {
  const rows = database
    .prepare(
      `SELECT s.id, s.day, s.time_from, s.time_to, s.court_number, s.team_id, s.label_override,
              CASE WHEN s.team_id IS NOT NULL
                   THEN trim(t.gender || ' ' || t.category || ' ' || t.liga)
                   ELSE s.label_override END AS display_label
       FROM training_slots s LEFT JOIN teams t ON t.id = s.team_id
       ORDER BY s.time_from, s.time_to, s.court_number`,
    )
    .all() as SlotRow[];

  return rows.map((row) => ({
    id: row.id,
    day: row.day as TrainingDay,
    timeFrom: row.time_from,
    timeTo: row.time_to,
    courtNumber: row.court_number,
    teamId: row.team_id,
    labelOverride: row.label_override,
    displayLabel: row.display_label,
  }));
}

interface NormalizedGridItem {
  day: string;
  timeFrom: string;
  timeTo: string;
  courtNumber: number;
  teamId: number | null;
  labelOverride: string;
}

function validateGridItem(item: GridItem): NormalizedGridItem | null {
  if (!(TRAINING_DAYS as readonly string[]).includes(item.day)) {
    throw new ValidationError("Ungültiger Tag.");
  }
  if (!TIME_PATTERN.test(item.time_from) || !TIME_PATTERN.test(item.time_to)) {
    throw new ValidationError("Zeitangaben müssen das Format HH:MM haben.");
  }
  if (item.time_from >= item.time_to) {
    throw new ValidationError("time_to muss nach time_from liegen.");
  }
  if (item.time_from < TRAINING_WINDOW_START || item.time_to > TRAINING_WINDOW_END) {
    throw new ValidationError("Trainingsgrid erlaubt nur Slots zwischen 18:00 und 22:00.");
  }
  const courtNumber = Number(item.court_number);
  if (!Number.isInteger(courtNumber) || courtNumber < MIN_COURT || courtNumber > MAX_COURT) {
    throw new ValidationError("court_number muss zwischen 1 und 4 liegen.");
  }

  const teamId = item.team_id == null || item.team_id === "" ? null : Number(item.team_id);
  const labelOverride = (item.label_override ?? "").trim();
  if (teamId === null && labelOverride === "") {
    return null; // leere Zelle – wird übersprungen
  }
  if (teamId !== null && (!Number.isInteger(teamId) || teamId <= 0)) {
    throw new ValidationError("team_id ist ungültig.");
  }
  return {
    day: item.day,
    timeFrom: item.time_from,
    timeTo: item.time_to,
    courtNumber,
    teamId,
    labelOverride: teamId !== null ? "" : labelOverride,
  };
}

export function saveTrainingGrid(database: TcwDatabase, items: GridItem[]): void {
  if (!Array.isArray(items)) {
    throw new ValidationError("items muss eine Liste sein.");
  }
  const normalized = items.map(validateGridItem).filter((item): item is NormalizedGridItem => item !== null);

  const deleteEvening = database.prepare(
    `DELETE FROM training_slots WHERE day = ? AND time_from >= '${TRAINING_WINDOW_START}' AND time_to <= '${TRAINING_WINDOW_END}'`,
  );
  const insert = database.prepare(
    `INSERT INTO training_slots (day, time_from, time_to, court_number, team_id, label_override)
     VALUES (@day, @timeFrom, @timeTo, @courtNumber, @teamId, @labelOverride)`,
  );

  runDatabaseWrite(() =>
    database.transaction(() => {
      for (const day of TRAINING_DAYS) {
        deleteEvening.run(day);
      }
      for (const item of normalized) {
        insert.run(item);
      }
    })(),
  );
}
