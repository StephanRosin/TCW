import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../db/connection.js";
import { createPlayer } from "./players-admin.js";
import { listMembers } from "../player-registry.js";

// Roster-Schreibpfad mit manuell eingetragener myTennisID (Bug: enrichPlayer
// wird dabei übersprungen, weil myTennisID nicht leer ist – ohne Netzwerk
// darf trotzdem eine Registerspiegelung stattfinden).
test("createPlayer: manuell gesetzte myTennisID spiegelt ohne Netzwerk ins Register", async () => {
  const db = openDatabase({ filePath: ":memory:" });
  const teamId = Number(
    db
      .prepare("INSERT INTO teams (gender, category, liga) VALUES ('Herren', '1', '3. Liga')")
      .run().lastInsertRowid,
  );

  await createPlayer(
    db,
    {
      name: "Test Spieler",
      klassierung: "R4",
      myTennisID: "https://www.mytennis.ch/de/spieler/123456",
      team_id: teamId,
      captain_status: 0,
    },
    1000,
  );

  const members = listMembers(db);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.profileUrl, "https://www.mytennis.ch/de/spieler/123456");
  db.close();
});

test("createPlayer setzt players.registry_id (harter FK aufs Register)", async () => {
  const db = openDatabase({ filePath: ":memory:" });
  db.prepare("INSERT INTO teams (gender, category, liga) VALUES ('m','Aktive','1. Liga')").run();
  const teamId = Number((db.prepare("SELECT id FROM teams").get() as { id: number }).id);
  await createPlayer(
    db,
    {
      name: "Test Spieler",
      klassierung: "R4",
      myTennisID: "https://www.mytennis.ch/de/spieler/654321",
      team_id: teamId,
      captain_status: 0,
    },
    1000,
  );
  const row = db
    .prepare("SELECT p.registry_id, r.profile_url FROM players p JOIN player_registry r ON r.id = p.registry_id")
    .get() as { registry_id: number; profile_url: string } | undefined;
  assert.ok(row && row.registry_id > 0, "registry_id gesetzt");
  assert.equal(row.profile_url, "https://www.mytennis.ch/de/spieler/654321");
  db.close();
});
