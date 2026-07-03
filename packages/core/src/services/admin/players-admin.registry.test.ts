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
