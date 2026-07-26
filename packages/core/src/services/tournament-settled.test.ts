import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase, type TcwDatabase } from "../db/connection.js";
import { isTournamentSettled } from "./tournament-settled.js";

const TID = 158138;
const NOW = new Date(2026, 7, 3); // 03.08.2026

function seed(db: TcwDatabase, matches: Array<{ date: string; status: "open" | "played" }>): void {
  const insert = db.prepare(
    `INSERT INTO tournament_matches (
       tournament_id, event_id, match_key, tournament_name, event_name, mode,
       pool_name, round_name, scheduled_date, scheduled_time, court,
       player1_name, player1_name_2, player2_name, player2_name_2,
       result, status, winner_side, sort_order, updated_at
     ) VALUES (?, 1, ?, 'T', 'MS A', 'Draw', '', '', ?, '10:00', 'Platz 1', 'A', '', 'B', '', '', ?, 0, 0, 'x')`,
  );
  matches.forEach((m, index) => insert.run(TID, `m${index}`, m.date, m.status));
}

test("durchgespieltes Turnier gilt ab dem Tag nach der letzten Partie als abgeschlossen", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { date: "2026-07-18", status: "played" },
    { date: "2026-07-25", status: "played" },
  ]);
  assert.equal(isTournamentSettled(db, TID, NOW), true); // 03.08., lange vorbei
  // Schon am Folgetag der letzten Partie – keine Wartezeit.
  assert.equal(isTournamentSettled(db, TID, new Date(2026, 6, 26)), true);
  db.close();
});

test("am Spieltag selbst wird weiter importiert (Ergebnisse laufen nach)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [{ date: "2026-07-25", status: "played" }]);
  assert.equal(isTournamentSettled(db, TID, new Date(2026, 6, 25, 23, 30)), false);
  db.close();
});

test("offene Partien verhindern den Abschluss, auch bei altem Datum", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { date: "2026-07-01", status: "played" },
    { date: "2026-07-02", status: "open" },
  ]);
  assert.equal(isTournamentSettled(db, TID, NOW), false);
  db.close();
});

test("neu aufgeschaltetes Turnier ohne Partien wird importiert", () => {
  const db = openDatabase({ filePath: ":memory:" });
  assert.equal(isTournamentSettled(db, TID, NOW), false);
  db.close();
});

test("gespielte Partien ganz ohne Termin gelten nicht als abgeschlossen", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [{ date: "", status: "played" }]);
  assert.equal(isTournamentSettled(db, TID, NOW), false);
  db.close();
});

test("andere Turniere beeinflussen das Ergebnis nicht", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [{ date: "2026-07-25", status: "played" }]);
  // Fremdes Turnier mit offener Partie darf hier nichts ändern.
  db.prepare(
    `INSERT INTO tournament_matches (tournament_id, event_id, match_key, tournament_name, event_name, mode,
       pool_name, round_name, scheduled_date, scheduled_time, court, player1_name, player2_name,
       result, status, winner_side, sort_order, updated_at)
     VALUES (999, 1, 'x', 'Anderes', 'MS', 'Draw', '', '', '2026-08-19', '10:00', '', 'A', 'B', '', 'open', 0, 0, 'x')`,
  ).run();
  assert.equal(isTournamentSettled(db, TID, NOW), true);
  db.close();
});
