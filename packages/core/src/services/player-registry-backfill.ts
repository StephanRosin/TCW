/**
 * Einmaliges, wiederholbares Backfill des Spieler-Registers aus den verstreuten
 * Bestandstabellen. Reihenfolge = Priorität: Team-Kader (Mitglied), dann
 * Turnier-Anmeldungen (Lizenz/URL), dann Begegnungen/Gegner-Cache (URL).
 */
import { upsertPlayer } from "./player-registry.js";
import { playerNameKey } from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

function tableExists(db: TcwDatabase, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

/**
 * Sucht zu einem name_key einen echten Namen (unterscheidet sich von seinem eigenen
 * Namensschlüssel) unter den vier Begegnungs-Slots in player_matches. Liefert null,
 * falls kein echter Name gefunden wird.
 */
function findRealNameForKey(db: TcwDatabase, nameKey: string): string | null {
  if (!tableExists(db, "player_matches")) return null;
  for (const slot of ["s1p1", "s1p2", "s2p1", "s2p2"]) {
    const row = db
      .prepare(`SELECT ${slot}_name AS name FROM player_matches WHERE ${slot}_key = ? AND ${slot}_name <> '' LIMIT 50`)
      .all(nameKey) as Array<{ name: string }>;
    for (const r of row) {
      if (r.name.trim() !== playerNameKey(r.name)) return r.name;
    }
  }
  return null;
}

export function backfillPlayerRegistry(db: TcwDatabase): { total: number } {
  const run = db.transaction(() => {
    // Reihenfolge = Priorität: Team-Kader (Mitglied), Turnier-Anmeldungen (Lizenz/URL),
    // Begegnungen (Gegner-URL), zuletzt der alte Gegner-URL-Cache.
    backfillRosterMembers(db);
    backfillTournamentRegistrations(db);
    backfillPlayerMatchOpponents(db);
    backfillOpponentUrlCache(db);
  });
  run();
  const total = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  return { total };
}

/**
 * Team-Kader -> Mitglied (und harter FK players.registry_id, sofern gültige id).
 * WICHTIG: Ist players.registry_id bereits gesetzt (harter FK), NICHT erneut per
 * Namensschlüssel upserten — sonst entsteht bei bereits URL-verknüpften Registerzeilen
 * eine name-only-Dublette. Stattdessen die bestehende Zeile idempotent als Mitglied markieren.
 */
function backfillRosterMembers(db: TcwDatabase): void {
  for (const r of db.prepare("SELECT id, name, registry_id FROM players").all() as Array<{ id: number; name: string; registry_id: number | null }>) {
    if (r.registry_id && r.registry_id > 0) {
      // Schon verknüpft → nur Mitgliedschaft sicherstellen (KEIN Duplikat).
      // member_source='admin' nie überschreiben; is_tcw_member nie degradieren.
      db.prepare(
        "UPDATE player_registry SET is_tcw_member = 1, member_source = COALESCE(member_source, 'roster'), updated_at = datetime('now') WHERE id = ? AND (member_source IS NULL OR member_source <> 'admin')",
      ).run(r.registry_id);
    } else {
      // Noch nicht verknüpft (frische DB): name-only Mitglied anlegen + verknüpfen.
      const regId = upsertPlayer(db, { name: r.name, member: true, memberSource: "roster" });
      if (regId > 0) db.prepare("UPDATE players SET registry_id = ? WHERE id = ?").run(regId, r.id);
    }
  }
}

/**
 * Turnier-Anmeldungen (beide Doppel-Spieler). Ohne klassierung-Param behält
 * upsertPlayer den bestehenden Register-Wert.
 */
function backfillTournamentRegistrations(db: TcwDatabase): void {
  for (const r of db.prepare("SELECT player_name, player_name_2, player_url, player_url_2, license_number, license_number_2 FROM tournament_players").all() as Array<Record<string, string | null>>) {
    if (r.player_name) upsertPlayer(db, { name: r.player_name, url: r.player_url, license: r.license_number });
    if (r.player_name_2) upsertPlayer(db, { name: r.player_name_2, url: r.player_url_2, license: r.license_number_2 });
  }
}

/** Begegnungen: alle vier Slots (Spieler + Gegner) ins Register heben. */
function backfillPlayerMatchOpponents(db: TcwDatabase): void {
  if (!tableExists(db, "player_matches")) return;
  for (const r of db.prepare("SELECT s1p1_name,s1p1_url,s1p2_name,s1p2_url,s2p1_name,s2p1_url,s2p2_name,s2p2_url FROM player_matches").all() as Array<Record<string, string | null>>) {
    for (const [n, u] of [[r.s1p1_name, r.s1p1_url], [r.s1p2_name, r.s1p2_url], [r.s2p1_name, r.s2p1_url], [r.s2p2_name, r.s2p2_url]] as Array<[string | null, string | null]>) {
      if (n) upsertPlayer(db, { name: n, url: u });
    }
  }
}

/**
 * Alte Gegner-URL-Cache-Werte (name_key -> url) ins Register heben. Der name_key ist
 * nur ein normalisierter Schlüssel: erst über die Begegnungen einen echten Namen suchen,
 * sonst den Key als letzten Ausweg verwenden. Die Cache-Tabelle wird hier NICHT gedroppt.
 */
function backfillOpponentUrlCache(db: TcwDatabase): void {
  if (!tableExists(db, "opponent_url_cache")) return;
  for (const r of db.prepare("SELECT name_key, url FROM opponent_url_cache WHERE url IS NOT NULL").all() as Array<{ name_key: string; url: string }>) {
    const realName = findRealNameForKey(db, r.name_key);
    upsertPlayer(db, { name: realName ?? r.name_key, url: r.url });
  }
}
