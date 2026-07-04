/**
 * Daten-Reparatur: player_registry-Zeilen, bei denen display_name versehentlich
 * gleich dem Namensschlüssel (name_key) ist — also kein echter Anzeigename,
 * sondern nur der normalisierte Suchschlüssel (z. B. "andreea laura sirbu").
 * Ursache war ein Bug im Backfill (Schritt 4, opponent_url_cache) sowie ein
 * upsertPlayer, das display_name bislang bedingungslos überschrieben hat.
 * Beides ist gefixt (siehe player-registry.ts / player-registry-backfill.ts);
 * dieses Skript repariert die dadurch bereits verunstalteten Bestandszeilen.
 *
 * Sucht je betroffener Zeile einen echten Namen (unterscheidet sich von seinem
 * eigenen Namensschlüssel):
 *   1) in den vier Begegnungs-Slots von player_matches (sNpM_name/sNpM_key),
 *   2) sonst in tournament_players (player_name/player_name_2).
 * Wird ein echter Name gefunden, wird display_name aktualisiert. KEIN Datenverlust:
 * Zeilen ohne Treffer bleiben unverändert (nur Logging).
 *
 * Idempotent — mehrfaches Ausführen ist unproblematisch.
 *
 *   npm run repair:registry-names
 */
import { loadConfig, openDatabase } from "@tcw/core";
import { playerNameKey } from "@tcw/shared";

function isRealName(name: string): boolean {
  return name.trim() !== playerNameKey(name);
}

const PLAYER_MATCHES_SLOTS = ["s1p1", "s1p2", "s2p1", "s2p2"] as const;

function findRealNameFromPlayerMatches(db: ReturnType<typeof openDatabase>, nameKey: string): string | null {
  const hasTable = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='player_matches'").get();
  if (!hasTable) return null;
  for (const slot of PLAYER_MATCHES_SLOTS) {
    const rows = db
      .prepare(`SELECT ${slot}_name AS name FROM player_matches WHERE ${slot}_key = ? AND ${slot}_name <> ''`)
      .all(nameKey) as Array<{ name: string }>;
    for (const r of rows) {
      if (isRealName(r.name)) return r.name.trim();
    }
  }
  return null;
}

function findRealNameFromTournamentPlayers(db: ReturnType<typeof openDatabase>, nameKey: string): string | null {
  const hasTable = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tournament_players'").get();
  if (!hasTable) return null;
  const rows = db
    .prepare(
      `SELECT player_name AS name FROM tournament_players WHERE player_name IS NOT NULL AND player_name <> ''
       UNION ALL
       SELECT player_name_2 AS name FROM tournament_players WHERE player_name_2 IS NOT NULL AND player_name_2 <> ''`,
    )
    .all() as Array<{ name: string }>;
  for (const r of rows) {
    if (playerNameKey(r.name) === nameKey && isRealName(r.name)) return r.name.trim();
  }
  return null;
}

function main(): void {
  const config = loadConfig();
  const db = openDatabase({ filePath: config.dbFilePath });

  const affected = db
    .prepare("SELECT id, name_key FROM player_registry WHERE display_name = name_key")
    .all() as Array<{ id: number; name_key: string }>;

  console.log(`Gefundene verunstaltete Zeilen (display_name = name_key): ${affected.length}`);

  let repaired = 0;
  let stillGarbled = 0;

  const update = db.prepare("UPDATE player_registry SET display_name = ?, updated_at = datetime('now') WHERE id = ?");

  for (const row of affected) {
    const realName = findRealNameFromPlayerMatches(db, row.name_key) ?? findRealNameFromTournamentPlayers(db, row.name_key);
    if (realName) {
      update.run(realName, row.id);
      repaired++;
    } else {
      stillGarbled++;
      console.log(`  kein echter Name gefunden für name_key="${row.name_key}" (id=${row.id})`);
    }
  }

  console.log(`Repariert: ${repaired}. Weiterhin ohne echten Namen: ${stillGarbled}.`);

  db.close();
}

main();
