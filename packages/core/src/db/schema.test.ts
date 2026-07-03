import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";

test("SCHEMA_SQL legt player_registry mit erwarteten Spalten an", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const cols = (db.prepare("PRAGMA table_info(player_registry)").all() as Array<{ name: string }>).map((c) => c.name);
  for (const expected of ["id", "mytennis_id", "name_key", "display_name", "profile_url", "klassierung", "license_number", "is_tcw_member", "member_source", "updated_at"]) {
    assert.ok(cols.includes(expected), `Spalte fehlt: ${expected}`);
  }
  db.close();
});

test("SCHEMA_SQL erzeugt opponent_url_cache nicht mehr", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='opponent_url_cache'").get();
  assert.equal(row, undefined);
  db.close();
});
