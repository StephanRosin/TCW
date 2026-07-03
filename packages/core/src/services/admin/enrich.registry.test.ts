import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../db/schema.js";
import { listMembers } from "../player-registry.js";

// enrich.ts schreibt nach dem Setzen von myTennisID zusätzlich ins Register.
// Da enrichPlayer eine Netzwerksuche macht, testen wir die Register-Spiegelung
// über die exportierte Hilfsfunktion syncPlayerToRegistry (siehe Implementierung).
import { syncPlayerToRegistry } from "./enrich.js";

test("syncPlayerToRegistry: Kaderspieler wird Mitglied mit URL", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  syncPlayerToRegistry(db, { name: "Emma Hubeková", klassierung: "R1", myTennisID: "https://www.mytennis.ch/de/spieler/19824051" });
  const members = listMembers(db);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.profileUrl, "https://www.mytennis.ch/de/spieler/19824051");
  db.close();
});
