/**
 * Klassierungsänderungen für die öffentliche Anzeige.
 *
 * Sortierung: primär nach neuer Klassierung (Klassierungsordnung), dann
 * neueste Änderung zuerst, dann Name – stabil und nachvollziehbar.
 */
import {
  rankingOrder,
  safeExternalUrl,
  type RankingChange,
  type RankingChangesResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

interface RankingChangeRow {
  id: number;
  player_name: string;
  myTennisID: string;
  old_klassierung: string;
  new_klassierung: string;
  changed_at: string;
}

function compareRankingChanges(a: RankingChange, b: RankingChange): number {
  const [groupA, valueA] = rankingOrder(a.newKlassierung);
  const [groupB, valueB] = rankingOrder(b.newKlassierung);
  if (groupA !== groupB) return groupA - groupB;
  if (valueA !== valueB) return valueA - valueB;
  const byDate = b.changedAt.localeCompare(a.changedAt);
  if (byDate !== 0) return byDate;
  return a.playerName.localeCompare(b.playerName, "de", { sensitivity: "base" });
}

export function getRankingChanges(database: TcwDatabase): RankingChangesResponse {
  // Öffentlich nur echte Klassierungsänderungen von TCW-Mitgliedern:
  //  - nur Mitglieder (Join übers Register per Profil-URL, is_tcw_member = 1),
  //  - nur echte Änderungen (alte Klassierung nicht leer → sonst war es ein
  //    erstmaliges Erfassen, keine Änderung).
  const rows = database
    .prepare(
      `SELECT rc.id, rc.player_name, rc.myTennisID, rc.old_klassierung, rc.new_klassierung, rc.changed_at
         FROM ranking_changes rc
         JOIN player_registry r ON r.profile_url = rc.myTennisID AND r.is_tcw_member = 1
        WHERE TRIM(COALESCE(rc.old_klassierung, '')) <> ''`,
    )
    .all() as RankingChangeRow[];

  const items: RankingChange[] = rows
    .map((row) => ({
      id: row.id,
      playerName: row.player_name,
      myTennisUrl: safeExternalUrl(row.myTennisID),
      oldKlassierung: row.old_klassierung,
      newKlassierung: row.new_klassierung,
      changedAt: row.changed_at,
    }))
    .sort(compareRankingChanges);

  return { items };
}
