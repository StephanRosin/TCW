import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../db/schema.js";
import { listMembers, upsertPlayer } from "../player-registry.js";

// enrich.ts schreibt nach dem Setzen von myTennisID zusätzlich ins Register.
// Da enrichPlayer eine Netzwerksuche macht, testen wir die Register-Spiegelung
// über die exportierte Hilfsfunktion syncPlayerToRegistry (siehe Implementierung).
import { applyRegistryKlassierung, syncPlayerToRegistry } from "./enrich.js";

test("syncPlayerToRegistry: Kaderspieler wird Mitglied mit URL", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  syncPlayerToRegistry(db, { name: "Emma Hubeková", klassierung: "R1", myTennisID: "https://www.mytennis.ch/de/spieler/19824051" });
  const members = listMembers(db);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.profileUrl, "https://www.mytennis.ch/de/spieler/19824051");
  db.close();
});

test("applyRegistryKlassierung: schreibt Register + Log bei echter Änderung, players bleibt unberührt", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);

  const registryId = upsertPlayer(db, {
    name: "Anna Muster",
    url: "https://www.mytennis.ch/de/spieler/12345",
    klassierung: "R7",
  });
  assert.ok(registryId > 0);

  const row = {
    id: registryId,
    display_name: "Anna Muster",
    profile_url: "https://www.mytennis.ch/de/spieler/12345",
    klassierung: "R7",
  };

  const changed = applyRegistryKlassierung(db, row, "R9");
  assert.equal(changed, true);

  const registryRow = db.prepare("SELECT klassierung FROM player_registry WHERE id = ?").get(registryId) as {
    klassierung: string;
  };
  assert.equal(registryRow.klassierung, "R9");

  const changes = db.prepare("SELECT player_id, player_name, myTennisID, old_klassierung, new_klassierung FROM ranking_changes").all() as Array<{
    player_id: number;
    player_name: string;
    myTennisID: string;
    old_klassierung: string;
    new_klassierung: string;
  }>;
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], {
    player_id: registryId,
    player_name: "Anna Muster",
    myTennisID: "https://www.mytennis.ch/de/spieler/12345",
    old_klassierung: "R7",
    new_klassierung: "R9",
  });

  // Zweiter Aufruf mit derselben Klassierung: keine Änderung, kein neuer Log-Eintrag.
  const unchanged = applyRegistryKlassierung(db, { ...row, klassierung: "R9" }, "R9");
  assert.equal(unchanged, false);
  const changesAfter = db.prepare("SELECT COUNT(*) AS n FROM ranking_changes").get() as { n: number };
  assert.equal(changesAfter.n, 1);

  // players-Tabelle bleibt komplett unberührt (in diesem Test nie befüllt).
  const playersCount = db.prepare("SELECT COUNT(*) AS n FROM players").get() as { n: number };
  assert.equal(playersCount.n, 0);

  db.close();
});
