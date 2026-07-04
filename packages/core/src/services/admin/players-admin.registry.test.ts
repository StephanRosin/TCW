import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../db/connection.js";
import { createPlayer, listPlayers } from "./players-admin.js";
import { listMembers } from "../player-registry.js";

// Roster-Schreibpfad mit numerischer mytennis-ID: die URL ist aus der ID baubar,
// daher netzfrei. Der Spieler landet als Mitglied im Register (mit Profil-URL),
// players.registry_id ist gesetzt und listPlayers liefert die numerische ID zurück.
test("createPlayer: numerische mytennisId spiegelt netzfrei ins Register (Mitglied + URL + FK)", async () => {
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
      mytennisId: "654321",
      team_id: teamId,
      captain_status: 0,
    },
    1000,
  );

  // players-Zeile existiert mit gesetztem registry_id (harter FK aufs Register).
  const row = db
    .prepare("SELECT p.registry_id, r.profile_url, r.is_tcw_member, r.member_source FROM players p JOIN player_registry r ON r.id = p.registry_id")
    .get() as
    | { registry_id: number; profile_url: string; is_tcw_member: number; member_source: string }
    | undefined;
  assert.ok(row && row.registry_id > 0, "registry_id gesetzt");
  assert.equal(row.profile_url, "https://www.mytennis.ch/de/spieler/654321");
  assert.equal(row.is_tcw_member, 1, "Register-Eintrag ist Mitglied");
  assert.equal(row.member_source, "roster");

  // Register hat genau diesen einen Spieler als Mitglied.
  const members = listMembers(db);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.profileUrl, "https://www.mytennis.ch/de/spieler/654321");

  // listPlayers liest Klassierung + numerische ID übers Register.
  const players = listPlayers(db);
  assert.equal(players.length, 1);
  assert.equal(players[0]!.mytennisId, "654321");
  assert.equal(players[0]!.klassierung, "R4");
  db.close();
});

// Invariante: auch ohne mytennisId ist der Spieler danach Mitglied mit gesetztem
// registry_id (name-only). Der einwortige Name lässt enrichPlayer vor jedem
// Netzwerkzugriff aussteigen → der Test bleibt netzfrei.
test("createPlayer: ohne mytennisId trotzdem Mitglied mit registry_id (Invariante, netzfrei)", async () => {
  const db = openDatabase({ filePath: ":memory:" });
  const teamId = Number(
    db.prepare("INSERT INTO teams (gender, category, liga) VALUES ('Herren', '1', '3. Liga')").run().lastInsertRowid,
  );

  await createPlayer(
    db,
    { name: "Einzelname", klassierung: "", mytennisId: "", team_id: teamId, captain_status: 0 },
    1000,
  );

  const row = db
    .prepare("SELECT p.registry_id, r.is_tcw_member, r.member_source FROM players p JOIN player_registry r ON r.id = p.registry_id")
    .get() as { registry_id: number; is_tcw_member: number; member_source: string } | undefined;
  assert.ok(row && row.registry_id > 0, "registry_id gesetzt");
  assert.equal(row.is_tcw_member, 1, "name-only Register-Eintrag ist Mitglied");
  assert.equal(row.member_source, "roster");
  db.close();
});
