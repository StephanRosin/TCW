import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../db/schema.js";
import { upsertPlayer } from "./player-registry.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}
function rows(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare("SELECT * FROM player_registry").all() as Array<Record<string, unknown>>;
}

test("upsertPlayer: merge per mytennis_id, egal welche Namensreihenfolge", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Rauch Markus (R4)", url: "https://www.mytennis.ch/de/spieler/177712" });
  upsertPlayer(db, { name: "Markus Rauch", url: "https://www.mytennis.ch/de/spieler/177712", klassierung: "R4" });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.mytennis_id, "177712");
  assert.equal(all[0]!.profile_url, "https://www.mytennis.ch/de/spieler/177712");
  assert.equal(all[0]!.klassierung, "R4");
  db.close();
});

test("upsertPlayer: nur Name (ohne URL) legt name-only-Zeile an, URL reichert spaeter an", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Kramer Sophia (R6)" });
  let all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.mytennis_id, null);
  upsertPlayer(db, { name: "Sophia Kramer", url: "https://www.mytennis.ch/de/spieler/19806736" });
  all = rows(db);
  assert.equal(all.length, 1, "name-only-Zeile wird per name_key angereichert, nicht dupliziert");
  assert.equal(all[0]!.mytennis_id, "19806736");
  db.close();
});

test("upsertPlayer: unsichere URL wird ignoriert", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Foo Bar", url: "https://evil.example/de/spieler/1" });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.mytennis_id, null);
  assert.equal(all[0]!.profile_url, null);
  db.close();
});
