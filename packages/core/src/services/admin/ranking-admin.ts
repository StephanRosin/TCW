/**
 * Admin-Verwaltung der Klassierungsänderungen (bearbeiten, löschen).
 * Neue Einträge entstehen nur durch das Klassierungsupdate, nicht manuell.
 */
import type { AdminRankingChange } from "@tcw/shared";
import type { TcwDatabase } from "../../db/connection.js";
import { ValidationError } from "./errors.js";

interface RankingChangeRow {
  id: number;
  player_id: number;
  player_name: string;
  myTennisID: string;
  old_klassierung: string;
  new_klassierung: string;
  changed_at: string;
}

export interface RankingChangeInput {
  player_name: string;
  myTennisID: string;
  old_klassierung: string;
  new_klassierung: string;
  changed_at: string;
}

export function listRankingChanges(database: TcwDatabase): AdminRankingChange[] {
  const rows = database
    .prepare(
      "SELECT id, player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at FROM ranking_changes ORDER BY datetime(changed_at) DESC, id DESC",
    )
    .all() as RankingChangeRow[];
  return rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    myTennisID: row.myTennisID,
    oldKlassierung: row.old_klassierung,
    newKlassierung: row.new_klassierung,
    changedAt: row.changed_at,
  }));
}

export function updateRankingChange(
  database: TcwDatabase,
  id: number,
  input: Partial<RankingChangeInput>,
): void {
  if (String(input.player_name ?? "").trim() === "") {
    throw new ValidationError("Feld 'player_name' ist erforderlich.");
  }
  if (String(input.changed_at ?? "").trim() === "") {
    throw new ValidationError("Feld 'changed_at' ist erforderlich.");
  }
  database
    .prepare(
      "UPDATE ranking_changes SET player_name = @player_name, myTennisID = @myTennisID, old_klassierung = @old_klassierung, new_klassierung = @new_klassierung, changed_at = @changed_at WHERE id = @id",
    )
    .run({
      player_name: String(input.player_name).trim(),
      myTennisID: String(input.myTennisID ?? "").trim(),
      old_klassierung: String(input.old_klassierung ?? "").trim().toUpperCase(),
      new_klassierung: String(input.new_klassierung ?? "").trim().toUpperCase(),
      changed_at: String(input.changed_at).trim(),
      id,
    });
}

export function deleteRankingChange(database: TcwDatabase, id: number): void {
  database.prepare("DELETE FROM ranking_changes WHERE id = ?").run(id);
}
