import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../db/schema.js";
import { backfillPlayerRegistry } from "./player-registry-backfill.js";
import { resolveUrlByNameKey, listMembers } from "./player-registry.js";
import { playerNameKey } from "@tcw/shared";

function seeded(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  // Spiegelt die ensureColumn-Migration aus openDatabase (connection.ts), da dieser
  // Test die Schema-SQL direkt anwendet statt openDatabase zu nutzen.
  db.exec("ALTER TABLE players ADD COLUMN registry_id INTEGER REFERENCES player_registry(id)");
  db.prepare("INSERT INTO teams (gender, category, liga) VALUES ('m','Aktive','1. Liga')").run();
  db.prepare("INSERT INTO players (name, klassierung, myTennisID, team_id) VALUES (?,?,?,1)")
    .run("Markus Rauch", "R4", "https://www.mytennis.ch/de/spieler/177712");
  db.prepare("INSERT INTO tournaments (name, swisstennis_tournament_id, registration_url, active, sort_order) VALUES ('T',158138,'',1,1)").run();
  db.prepare("INSERT INTO tournament_events (tournament_id,event_id,tournament_name,event_name,discipline,sort_order,updated_at) VALUES (158138,1,'T','MS','MS',1,datetime('now'))").run();
  db.prepare("INSERT INTO tournament_players (tournament_id,event_id,player_key,player_name,player_url,license_number) VALUES (158138,1,'k1','Till Novak','https://www.mytennis.ch/de/spieler/19799660','12345')").run();
  return db;
}

test("Backfill: Kader wird Mitglied, Turnierspieler non-member, URLs aufloesbar", () => {
  const db = seeded();
  const result = backfillPlayerRegistry(db);
  assert.ok(result.total >= 2);
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Markus Rauch")), "https://www.mytennis.ch/de/spieler/177712");
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Till Novak")), "https://www.mytennis.ch/de/spieler/19799660");
  const members = listMembers(db).map((m) => m.displayName);
  assert.deepEqual(members, ["Markus Rauch"]);
  const linked = db
    .prepare(
      "SELECT p.registry_id, r.profile_url FROM players p JOIN player_registry r ON r.id = p.registry_id WHERE p.name = 'Markus Rauch'",
    )
    .get() as { registry_id: number; profile_url: string } | undefined;
  assert.ok(linked && linked.registry_id > 0, "players.registry_id gesetzt");
  assert.equal(linked.profile_url, "https://www.mytennis.ch/de/spieler/177712");
  db.close();
});

test("Backfill: idempotent (zweiter Lauf aendert Anzahl nicht)", () => {
  const db = seeded();
  backfillPlayerRegistry(db);
  const after1 = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  backfillPlayerRegistry(db);
  const after2 = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  assert.equal(after1, after2);
  db.close();
});
