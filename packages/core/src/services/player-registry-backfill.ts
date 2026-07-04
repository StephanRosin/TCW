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
    // 1) Team-Kader -> Mitglied (und harter FK players.registry_id, sofern gültige id).
    //    Klassierung/URL kommen nicht mehr aus players (Spalten werden gedroppt), sondern
    //    liegen bereits im Register (enrich/Turnier-Import/CM-Sync).
    //    WICHTIG: Ist players.registry_id bereits gesetzt (harter FK), NICHT erneut per
    //    Namensschlüssel upserten — sonst entsteht bei bereits URL-verknüpften Registerzeilen
    //    eine name-only-Dublette (upsertPlayer matcht name-only nur gegen mytennis_id IS NULL).
    //    Stattdessen die bestehende Zeile direkt als Mitglied markieren (idempotent, kein Duplikat).
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
    // 2) Turnier-Anmeldungen (beide Doppel-Spieler)
    //    Klassierung kommt nicht mehr aus tournament_players (Spalten ranking/ranking_2
    //    gedroppt) — ohne klassierung-Param behält upsertPlayer den bestehenden Register-Wert.
    for (const r of db.prepare("SELECT player_name, player_name_2, player_url, player_url_2, license_number, license_number_2 FROM tournament_players").all() as Array<Record<string, string | null>>) {
      if (r.player_name) upsertPlayer(db, { name: r.player_name, url: r.player_url, license: r.license_number });
      if (r.player_name_2) upsertPlayer(db, { name: r.player_name_2, url: r.player_url_2, license: r.license_number_2 });
    }
    // 3) Begegnungen (Spieler + Gegner)
    if (tableExists(db, "player_matches")) {
      for (const r of db.prepare("SELECT s1p1_name,s1p1_url,s1p2_name,s1p2_url,s2p1_name,s2p1_url,s2p2_name,s2p2_url FROM player_matches").all() as Array<Record<string, string | null>>) {
        for (const [n, u] of [[r.s1p1_name, r.s1p1_url], [r.s1p2_name, r.s1p2_url], [r.s2p1_name, r.s2p1_url], [r.s2p2_name, r.s2p2_url]] as Array<[string | null, string | null]>) {
          if (n) upsertPlayer(db, { name: n, url: u });
        }
      }
    }
    // 4) Alte Gegner-URL-Cache-Werte (name_key -> url) ins Register heben.
    //    Die Tabelle wird hier NICHT gedroppt (Datensicherheit) — das Entfernen
    //    passiert erst nach Backup + Verifikation in einem späteren, manuellen Schritt.
    if (tableExists(db, "opponent_url_cache")) {
      for (const r of db.prepare("SELECT name_key, url FROM opponent_url_cache WHERE url IS NOT NULL").all() as Array<{ name_key: string; url: string }>) {
        // name_key ist nur ein normalisierter Schlüssel, kein Anzeigename: erst versuchen,
        // über die Begegnungen (player_matches) einen echten Namen zu finden. Nur wenn
        // keiner existiert, den Key als letzten Ausweg verwenden (upsertPlayer clobbert
        // damit ohnehin keinen bereits vorhandenen echten Namen mehr, siehe Teil A).
        const realName = findRealNameForKey(db, r.name_key);
        upsertPlayer(db, { name: realName ?? r.name_key, url: r.url });
      }
    }
  });
  run();
  const total = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  return { total };
}
