import assert from "node:assert/strict";
import { test } from "node:test";
import { playerNameKey } from "@tcw/shared";
import { openDatabase } from "../db/connection.js";
import { getPlayerMatches, getTickerMatches, importTournaments, isoToSwissDate, suggestPlayers, toSortKey } from "./player-matches-service.js";

test("isoToSwissDate wandelt ISO in IC/TC-Format (D.M.YYYY ohne führende Nullen)", () => {
  assert.equal(isoToSwissDate("2026-06-24"), "24.6.2026");
  assert.equal(isoToSwissDate("2026-06-24T19:00:00+00:00"), "24.6.2026");
  assert.equal(isoToSwissDate("2026-05-07"), "7.5.2026");
  assert.equal(isoToSwissDate("24.6.2026"), "24.6.2026");
  assert.equal(isoToSwissDate(""), "");
});

test("toSortKey wandelt deutsches Datum und ISO in sortierbares ISO-Format", () => {
  assert.equal(toSortKey("7.6.2026"), "2026-06-07");
  assert.equal(toSortKey("17.05.2026"), "2026-05-17");
  assert.equal(toSortKey("2026-06-07"), "2026-06-07");
  assert.equal(toSortKey(""), "");
  // Chronologisch korrekt: 10.5. nach 7.6. (anders als String-Vergleich).
  assert.ok(toSortKey("7.6.2026") > toSortKey("10.5.2026"));
});

test("playerNameKey ist reihenfolge-unabhängig und ohne Klassierung/Diakritika", () => {
  assert.equal(playerNameKey("Rosin Stephan (R4)"), playerNameKey("Stephan Rosin"));
  assert.equal(playerNameKey("Hubeková Emma"), playerNameKey("Emma Hubekova"));
  assert.notEqual(playerNameKey("Stephan Rosin"), playerNameKey("Stefan Rosin"));
});

function seedMatch(db: ReturnType<typeof openDatabase>): void {
  // Begegnung 2026: Heim (Seite 1) = Gegner-Team, Gast (Seite 2) = gesuchter Spieler.
  db.prepare(
    `INSERT INTO player_matches (
       match_uid, year, competition_code, competition_label, discipline, match_date, sort_key,
       s1p1_name, s1p1_key, s2p1_name, s2p1_key, s2p1_url,
       result, winner_side, match_url, updated_at
     ) VALUES (
       'ic:1:single:4', 2026, 'ic', 'IC 35+ NLC', 'single', '2026-06-07', '2026-06-07',
       'Chadha Avrath', @oppKey, 'Rosin Stephan', @ownKey, 'https://example.test/rosin',
       '6:1 2:6 5:7', 2, 'https://example.test/encount', '2026-06-08T00:00:00Z'
     )`,
  ).run({ oppKey: playerNameKey("Chadha Avrath"), ownKey: playerNameKey("Stephan Rosin") });
}

test("getPlayerMatches dreht das Resultat auf die Perspektive des Spielers (Gast → Sieg)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seedMatch(db);
  const matches = getPlayerMatches(db, playerNameKey("Stephan Rosin"));
  assert.equal(matches.length, 1);
  const match = matches[0]!;
  // Heim-Sicht "6:1 2:6 5:7" → aus Gast-/Spielersicht gespiegelt.
  assert.equal(match.result, "1:6 6:2 7:5");
  assert.equal(match.won, true); // winner_side 2 = Gast = Spieler
  assert.equal(match.competition, "IC 35+ NLC");
  assert.equal(match.partner, null);
  assert.deepEqual(
    match.opponents.map((o) => o.name),
    ["Chadha Avrath"],
  );
  db.close();
});

test("suggestPlayers ab 3 Zeichen, dedupliziert über Namens-Schlüssel", () => {
  const db = openDatabase({ filePath: ":memory:" });
  db.prepare("INSERT INTO teams (id, gender, category, liga) VALUES (1,'Herren','Aktiv','NLC')").run();
  // Gleicher Spieler in zwei Teams → ein Vorschlag.
  db.prepare(
    "INSERT INTO players (name, klassierung, myTennisID, team_id) VALUES ('Stephan Rosin','R4','https://www.mytennis.ch/de/spieler/19799802',1)",
  ).run();
  db.prepare(
    "INSERT INTO players (name, klassierung, myTennisID, team_id) VALUES ('Stephan Rosin','R4','https://www.mytennis.ch/de/spieler/19799802',1)",
  ).run();
  assert.equal(suggestPlayers(db, "Ro").length, 0); // < 3 Zeichen
  const hits = suggestPlayers(db, "Rosin");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.key, playerNameKey("Stephan Rosin"));
  assert.equal(hits[0]!.url, "https://www.mytennis.ch/de/spieler/19799802");
  db.close();
});

test("getTickerMatches liefert die neuesten Matches zuerst und respektiert das Limit", () => {
  const db = openDatabase({ filePath: ":memory:" });
  const insert = db.prepare(
    `INSERT INTO player_matches (
       match_uid, year, competition_code, competition_label, discipline, match_date, sort_key,
       s1p1_name, s1p1_key, s2p1_name, s2p1_key, result, winner_side, updated_at
     ) VALUES (@uid, 2026, 'cm', 'CM', 'single', @date, @sort, 'A Eins', 'a', 'B Zwei', 'b', '6:0 6:0', 1, @upd)`,
  );
  insert.run({ uid: "t:1", date: "1.6.2026", sort: "2026-06-01", upd: "2026-06-01T10:00:00Z" });
  insert.run({ uid: "t:2", date: "3.6.2026", sort: "2026-06-03", upd: "2026-06-03T10:00:00Z" });
  insert.run({ uid: "t:3", date: "2.6.2026", sort: "2026-06-02", upd: "2026-06-02T10:00:00Z" });

  const all = getTickerMatches(db);
  assert.deepEqual(all.map((m) => m.date), ["3.6.2026", "2.6.2026", "1.6.2026"]);
  assert.deepEqual(all[0]!.side1, [{ name: "A Eins", url: null }]);
  assert.equal(all[0]!.winnerSide, 1);

  const limited = getTickerMatches(db, 2);
  assert.equal(limited.length, 2);
  db.close();
});

test("importTournaments ignoriert inaktive Turniere und entfernt deren Altbestand", () => {
  const db = openDatabase({ filePath: ":memory:" });
  const insertTournament = db.prepare(
    "INSERT INTO tournaments (name, swisstennis_tournament_id, active) VALUES (?, ?, ?)",
  );
  insertTournament.run("Waidcup 2026", 158138, 1);
  insertTournament.run("Waidcup TEST", 999001, 0);

  const insertMatch = db.prepare(
    `INSERT INTO tournament_matches (
       tournament_id, event_id, match_key, tournament_name, event_name, mode,
       player1_name, player2_name, result, status, winner_side, updated_at
     ) VALUES (@tid, 1, 'm1', @tname, 'MS A R1/R5', 'tree', 'Echt Emil', 'Real Rita', '6:1 6:2', 'played', 1, '2026-07-01T10:00:00Z')`,
  );
  insertMatch.run({ tid: 158138, tname: "Waidcup 2026" });
  insertMatch.run({ tid: 999001, tname: "Waidcup TEST" });

  // Altbestand: Dummy-Match aus dem Testturnier wurde frueher schon importiert.
  db.prepare(
    `INSERT INTO player_matches (
       match_uid, year, competition_code, competition_label, discipline, match_date, sort_key,
       s1p1_name, s1p1_key, s2p1_name, s2p1_key, result, winner_side, updated_at
     ) VALUES ('tour:999001:1:m1', 2026, 'waidcup', 'Waidcup', 'single', '1.7.2026', '2026-07-01',
       'Dummy Doris', 'dorisdummy', 'Fake Fred', 'fakefred', '6:0 6:0', 1, '2026-07-01T10:00:00Z')`,
  ).run();

  importTournaments(db, "2026", "2026-07-02T12:00:00Z");

  const ticker = getTickerMatches(db);
  assert.equal(ticker.length, 1);
  assert.equal(ticker[0]!.side1[0]!.name, "Echt Emil");
  const stale = db
    .prepare("SELECT COUNT(*) AS n FROM player_matches WHERE match_uid LIKE 'tour:999001:%'")
    .get() as { n: number };
  assert.equal(stale.n, 0);
  db.close();
});
