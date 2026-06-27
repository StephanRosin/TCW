/**
 * MyTennis-Anreicherung von Spielern und Klassierungsaktualisierung.
 *
 * - Neuer Spieler / Namensänderung → Suche und Übernahme von Klassierung + URL.
 * - Klassierungsupdate → nur echte Änderungen werden geschrieben und in
 *   `ranking_changes` protokolliert (Treffer-Zuordnung über die gespeicherte URL).
 */
import type { TcwDatabase } from "../../db/connection.js";
import { chooseBestHit, searchPlayers } from "../../integrations/mytennis/search.js";

export interface EnrichResult {
  klassierung: string;
  myTennisID: string;
}

function splitName(name: string): { firstName: string; lastName: string } | null {
  const parts = name.trim().split(/\s+/).filter((part) => part !== "");
  if (parts.length < 2) {
    return null;
  }
  return { firstName: parts[0]!, lastName: parts[parts.length - 1]! };
}

/** Sucht den besten MyTennis-Treffer und schreibt Klassierung + URL zurück. */
export async function enrichPlayer(
  database: TcwDatabase,
  playerId: number,
  timeoutMs: number,
): Promise<EnrichResult | null> {
  const player = database.prepare("SELECT name FROM players WHERE id = ?").get(playerId) as
    | { name: string }
    | undefined;
  if (!player) {
    return null;
  }
  const name = splitName(player.name);
  if (!name) {
    return null;
  }
  const hits = await searchPlayers(player.name, timeoutMs);
  const best = chooseBestHit(hits, name.firstName, name.lastName);
  if (!best || best.url === "") {
    return null;
  }
  const klassierung = best.classification.trim().toUpperCase();
  database
    .prepare("UPDATE players SET klassierung = ?, myTennisID = ? WHERE id = ?")
    .run(klassierung, best.url, playerId);
  return { klassierung, myTennisID: best.url };
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export interface RankingUpdateChange {
  playerName: string;
  oldKlassierung: string;
  newKlassierung: string;
}

export interface RankingUpdateSummary {
  updated: number;
  unchanged: number;
  skipped: number;
  changes: RankingUpdateChange[];
}

interface PlayerRow {
  id: number;
  name: string;
  myTennisID: string;
  klassierung: string;
}

/** Aktualisiert Klassierungen aller Spieler mit gespeicherter MyTennis-URL. */
export async function updateKlassierungenFromMyTennis(
  database: TcwDatabase,
  timeoutMs: number,
): Promise<RankingUpdateSummary> {
  const players = database
    .prepare(
      "SELECT id, name, myTennisID, klassierung FROM players WHERE trim(coalesce(myTennisID,'')) <> '' ORDER BY id",
    )
    .all() as PlayerRow[];

  const summary: RankingUpdateSummary = { updated: 0, unchanged: 0, skipped: 0, changes: [] };
  const applyChange = database.transaction((player: PlayerRow, newRank: string) => {
    database.prepare("UPDATE players SET klassierung = ? WHERE id = ?").run(newRank, player.id);
    database
      .prepare(
        `INSERT INTO ranking_changes (player_id, player_name, myTennisID, old_klassierung, new_klassierung)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(player.id, player.name, player.myTennisID, player.klassierung.toUpperCase(), newRank);
  });

  for (const player of players) {
    const name = splitName(player.name);
    if (!name) {
      summary.skipped += 1;
      continue;
    }
    const hits = await searchPlayers(player.name, timeoutMs);
    const targetUrl = normalizeUrl(player.myTennisID);
    const hit = hits.find((candidate) => normalizeUrl(candidate.url) === targetUrl);
    if (!hit) {
      summary.skipped += 1;
      continue;
    }
    const newRank = hit.classification.trim().toUpperCase();
    if (newRank === "") {
      summary.skipped += 1;
      continue;
    }
    const currentRank = (player.klassierung ?? "").trim().toUpperCase();
    if (newRank === currentRank) {
      summary.unchanged += 1;
      continue;
    }
    applyChange(player, newRank);
    summary.updated += 1;
    summary.changes.push({
      playerName: player.name,
      oldKlassierung: currentRank,
      newKlassierung: newRank,
    });
  }
  return summary;
}
