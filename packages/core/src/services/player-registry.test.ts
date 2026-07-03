import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../db/schema.js";
import { upsertPlayer, resolveUrlByNameKey, resolveUrlsForNames, listMembers, setMembership } from "./player-registry.js";
import { playerNameKey } from "@tcw/shared";

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

test("resolveUrlByNameKey: eindeutiger Treffer liefert URL", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Rauch Markus (R4)", url: "https://www.mytennis.ch/de/spieler/177712" });
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Markus Rauch")), "https://www.mytennis.ch/de/spieler/177712");
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Unbekannt Person")), null);
  db.close();
});

test("resolveUrlByNameKey: mehrdeutiger name_key -> null (kein Rateversuch)", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Peter Meier", url: "https://www.mytennis.ch/de/spieler/111" });
  upsertPlayer(db, { name: "Meier Peter", url: "https://www.mytennis.ch/de/spieler/222" });
  // gleicher name_key, zwei verschiedene IDs -> ambig
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Peter Meier")), null);
  db.close();
});

test("resolveUrlsForNames: Bulk-Map nur mit eindeutigen Treffern", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Weiss Xenia (R5)", url: "https://www.mytennis.ch/de/spieler/19786267" });
  upsertPlayer(db, { name: "Kramer Sophia (R6)" }); // ohne URL
  const map = resolveUrlsForNames(db, ["Xenia Weiss", "Sophia Kramer", ""]);
  assert.deepEqual(map, { [playerNameKey("Weiss Xenia")]: "https://www.mytennis.ch/de/spieler/19786267" });
  db.close();
});

test("setMembership: admin schaltet an/aus, Import ueberschreibt admin nicht", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Bea Muster", url: "https://www.mytennis.ch/de/spieler/600" });
  const id = (db.prepare("SELECT id FROM player_registry").get() as { id: number }).id;
  setMembership(db, id, true);
  assert.equal(listMembers(db).length, 1);
  setMembership(db, id, false);
  upsertPlayer(db, { name: "Bea Muster", url: "https://www.mytennis.ch/de/spieler/600", member: true, memberSource: "ic-home" });
  assert.equal(listMembers(db).length, 0, "admin-off bleibt trotz ic-home-Import");
  db.close();
});

test("listMembers: Filter nach Namensteil, alphabetisch", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Zoe Adler", member: true, memberSource: "roster" });
  upsertPlayer(db, { name: "Alex Adler", member: true, memberSource: "roster" });
  upsertPlayer(db, { name: "Tom Baumann", member: true, memberSource: "roster" });
  const adlers = listMembers(db, { query: "adler" }).map((m) => m.displayName);
  assert.deepEqual(adlers, ["Alex Adler", "Zoe Adler"]);
  db.close();
});
