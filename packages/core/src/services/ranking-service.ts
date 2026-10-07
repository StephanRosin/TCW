/**
 * Klassierungsänderungen für die öffentliche Anzeige.
 *
 * Sortierung: primär nach neuer Klassierung (Klassierungsordnung), dann
 * neueste Änderung zuerst, dann Name – stabil und nachvollziehbar.
 */
import {
  cleanPlayerName,
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
  roster_name: string | null;
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

/** Spielraum, in dem Einträge noch zum selben Klassierungslauf zählen. */
const LATEST_RUN_WINDOW_DAYS = 30;

export function getRankingChanges(database: TcwDatabase): RankingChangesResponse {
  // Öffentlich nur echte Klassierungsänderungen von TCW-Mitgliedern:
  //  - nur Mitglieder (Join übers Register per Profil-URL, is_tcw_member = 1),
  //  - nur echte Änderungen (alte Klassierung nicht leer → sonst war es ein
  //    erstmaliges Erfassen, keine Änderung),
  //  - nur der letzte Lauf: Swiss Tennis klassiert zweimal im Jahr neu, ältere
  //    Runden bleiben in der Tabelle, werden aber nicht mehr gezeigt,
  //  - je Spieler nur die neueste Änderung,
  //  - Name aus dem Kader ("Vorname Nachname"), nicht der Importname.
  const rows = database
    .prepare(
      `WITH visible AS (
         SELECT rc.id, rc.player_name, rc.myTennisID, rc.old_klassierung, rc.new_klassierung, rc.changed_at,
                (SELECT p.name FROM players p WHERE p.registry_id = r.id ORDER BY p.id LIMIT 1) AS roster_name,
                ROW_NUMBER() OVER (PARTITION BY rc.myTennisID ORDER BY datetime(rc.changed_at) DESC, rc.id DESC) AS rn
           FROM ranking_changes rc
           JOIN player_registry r ON r.profile_url = rc.myTennisID AND r.is_tcw_member = 1
          WHERE TRIM(COALESCE(rc.old_klassierung, '')) <> ''
       )
       SELECT id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at, roster_name
         FROM visible
        WHERE rn = 1
          AND datetime(changed_at) >= datetime((SELECT MAX(datetime(changed_at)) FROM visible), ?)`,
    )
    .all(`-${LATEST_RUN_WINDOW_DAYS} days`) as RankingChangeRow[];

  const items: RankingChange[] = rows
    .map((row) => ({
      id: row.id,
      playerName: row.roster_name ?? cleanPlayerName(row.player_name),
      myTennisUrl: safeExternalUrl(row.myTennisID),
      oldKlassierung: row.old_klassierung,
      newKlassierung: row.new_klassierung,
      changedAt: row.changed_at,
    }))
    .sort(compareRankingChanges);

  return { items };
}
