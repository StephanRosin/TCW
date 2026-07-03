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

test("upsertPlayer: Import degradiert Mitgliedschaft nicht (kein Downgrade 1 -> 0)", () => {
  const db = freshDb();
  const url = "https://www.mytennis.ch/de/spieler/500001";
  upsertPlayer(db, { name: "Muster Anna", url, member: true, memberSource: "roster" });
  upsertPlayer(db, { name: "Muster Anna", url, member: false });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.is_tcw_member, 1);
  assert.equal(all[0]!.member_source, "roster");
  db.close();
});

test("upsertPlayer: admin-Quelle wird von Import nicht durch andere Quelle ueberschrieben", () => {
  const db = freshDb();
  const url = "https://www.mytennis.ch/de/spieler/500002";
  upsertPlayer(db, { name: "Muster Bruno", url, member: true, memberSource: "admin" });
  upsertPlayer(db, { name: "Muster Bruno", url, member: true, memberSource: "ic-home" });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.member_source, "admin");
  db.close();
});

test("upsertPlayer: admin-Quelle verhindert auch Downgrade der Mitgliedschaft", () => {
  const db = freshDb();
  const url = "https://www.mytennis.ch/de/spieler/500003";
  upsertPlayer(db, { name: "Muster Clara", url, member: true, memberSource: "admin" });
  upsertPlayer(db, { name: "Muster Clara", url, member: false });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.is_tcw_member, 1);
  assert.equal(all[0]!.member_source, "admin");
  db.close();
});

test("upsertPlayer: Werden einer Person neu Mitglied setzt die member_source", () => {
  const db = freshDb();
  const url = "https://www.mytennis.ch/de/spieler/500004";
  upsertPlayer(db, { name: "Muster David", url });
  upsertPlayer(db, { name: "Muster David", url, member: true, memberSource: "ic-home" });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.is_tcw_member, 1);
  assert.equal(all[0]!.member_source, "ic-home");
  db.close();
});
