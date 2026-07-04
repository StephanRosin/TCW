import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../db/connection.js";
import { upsertPlayer } from "./player-registry.js";
import { getPublicTeams } from "./teams-service.js";

test("getPublicTeams liest Klassierung + mytennis-URL aus dem Register, nicht aus den players-Spalten", () => {
  const db = openDatabase({ filePath: ":memory:" });

  const teamId = Number(
    db
      .prepare(
        "INSERT INTO teams (gender, category, liga, teamziel, trainingstag) VALUES ('Herren', '30', '3. Liga', '', '')",
      )
      .run().lastInsertRowid,
  );

  // Register-Eintrag mit den "wahren" Werten (Register-Klassierung + Profil-URL).
  const registryUrl = "https://www.mytennis.ch/de/spieler/177712";
  const registryId = upsertPlayer(db, {
    name: "Markus Rauch",
    url: registryUrl,
    klassierung: "R7",
  });

  // Spieler nur noch über registry_id ans Register gebunden: Klassierung/URL kommen
  // ausschließlich aus dem Register (die früheren players-Spalten wurden gedroppt).
  db.prepare(
    "INSERT INTO players (name, team_id, captain_status, registry_id) VALUES (?, ?, ?, ?)",
  ).run("Markus Rauch", teamId, 0, registryId);

  const result = getPublicTeams(db);
  const team = [...result.damen, ...result.herren].find((t) => t.id === teamId);
  assert.ok(team, "Team muss in der öffentlichen Antwort enthalten sein");
  const player = team!.players.find((p) => p.name === "Markus Rauch");
  assert.ok(player, "Spieler muss im Team enthalten sein");

  assert.equal(player!.klassierung, "R7", "Klassierung muss aus dem Register kommen, nicht aus players.klassierung");
  assert.equal(player!.myTennisUrl, registryUrl, "myTennisUrl muss aus dem Register kommen, nicht aus players.myTennisID");

  db.close();
});

test("getPublicTeams: NULL registry_id liefert leere Klassierung/URL statt den Spieler zu verlieren", () => {
  const db = openDatabase({ filePath: ":memory:" });

  const teamId = Number(
    db
      .prepare(
        "INSERT INTO teams (gender, category, liga, teamziel, trainingstag) VALUES ('Damen', '40', '2. Liga', '', '')",
      )
      .run().lastInsertRowid,
  );

  db.prepare(
    "INSERT INTO players (name, team_id, captain_status, registry_id) VALUES (?, ?, ?, NULL)",
  ).run("Ohne Register", teamId, 0);

  const result = getPublicTeams(db);
  const team = [...result.damen, ...result.herren].find((t) => t.id === teamId);
  assert.ok(team);
  const player = team!.players.find((p) => p.name === "Ohne Register");
  assert.ok(player, "Spieler ohne registry_id darf nicht aus der Antwort fallen (LEFT JOIN)");
  assert.equal(player!.klassierung, "");
  assert.equal(player!.myTennisUrl, "");

  db.close();
});
