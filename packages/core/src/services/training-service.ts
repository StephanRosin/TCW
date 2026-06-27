/**
 * Aufbau des öffentlichen Trainingsplans.
 *
 * Sichtbar sind nur die Abendstunden (18:00–22:00) und die Plätze 1–4;
 * Plätze 5/6 (Tennisschule) bleiben ausgeblendet. Teamnamen ergeben sich
 * dynamisch aus `team_id`, damit Admin-Änderungen sofort wirken.
 */
import {
  PUBLIC_TRAINING_COURTS,
  TRAINING_DAYS,
  TRAINING_WINDOW_END,
  TRAINING_WINDOW_START,
  type TrainingPlanResponse,
  type TrainingRow,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

interface SlotRow {
  day: string;
  time_from: string;
  time_to: string;
  court_number: number;
  team_gender: string | null;
  team_category: string | null;
  team_liga: string | null;
  label_override: string;
}

function slotLabel(row: SlotRow): string | null {
  if (row.team_gender !== null) {
    return `${row.team_gender} ${row.team_category} ${row.team_liga}`.replace(/\s+/g, " ").trim();
  }
  return row.label_override.trim() === "" ? null : row.label_override.trim();
}

function isWithinPublicWindow(row: SlotRow): boolean {
  return row.time_from >= TRAINING_WINDOW_START && row.time_to <= TRAINING_WINDOW_END;
}

function isPublicCourt(courtNumber: number): boolean {
  return (PUBLIC_TRAINING_COURTS as readonly number[]).includes(courtNumber);
}

export function getTrainingPlan(database: TcwDatabase): TrainingPlanResponse {
  const rows = database
    .prepare(
      `SELECT s.day, s.time_from, s.time_to, s.court_number, s.label_override,
              t.gender AS team_gender, t.category AS team_category, t.liga AS team_liga
       FROM training_slots s
       LEFT JOIN teams t ON t.id = s.team_id
       ORDER BY s.time_from, s.time_to, s.court_number`,
    )
    .all() as SlotRow[];

  const days: Record<string, TrainingRow[]> = {};
  for (const day of TRAINING_DAYS) {
    days[day] = [];
  }

  const rowsByWindow = new Map<string, TrainingRow>();
  for (const row of rows) {
    if (!isWithinPublicWindow(row) || !isPublicCourt(row.court_number)) {
      continue;
    }
    const windowKey = `${row.day} ${row.time_from}-${row.time_to}`;
    let trainingRow = rowsByWindow.get(windowKey);
    if (!trainingRow) {
      trainingRow = {
        time: `${row.time_from}-${row.time_to}`,
        courts: PUBLIC_TRAINING_COURTS.map(() => null),
      };
      rowsByWindow.set(windowKey, trainingRow);
      days[row.day]?.push(trainingRow);
    }
    const courtIndex = row.court_number - 1;
    trainingRow.courts[courtIndex] = slotLabel(row);
  }

  return { days };
}
