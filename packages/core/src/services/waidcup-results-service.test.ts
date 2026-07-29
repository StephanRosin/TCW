import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase, type TcwDatabase } from "../db/connection.js";
import { getWaidcupResults } from "./waidcup-results-service.js";

const TID = 444001;

function addEvent(db: TcwDatabase, eventId: number, name: string, discipline: string): void {
  db.prepare(
    `INSERT INTO tournament_events (tournament_id, event_id, tournament_name, event_name, discipline, source_descr, sort_order, updated_at)
     VALUES (?, ?, 'Waidcup', ?, ?, NULL, ?, 'x')`,
  ).run(TID, eventId, name, discipline, eventId);
}

function addMatch(db: TcwDatabase, eventId: number, key: string, status: "open" | "played"): void {
  db.prepare(
    `INSERT INTO tournament_matches (
       tournament_id, event_id, match_key, tournament_name, event_name, mode, pool_name, round_name,
       scheduled_date, scheduled_time, court, player1_name, player1_name_2, player2_name, player2_name_2,
       result, status, winner_side, sort_order, updated_at
     ) VALUES (?, ?, ?, 'Waidcup', 'E', 'Draw', '', 'Final', '2026-07-25', '10:00', 'Platz 1', 'A', '', 'B', '', '6:0 6:0', ?, 1, 0, 'x')`,
  ).run(TID, eventId, key, status);
}

function addExtras(db: TcwDatabase, eventId: number, bracket: unknown, pools: unknown): void {
  db.prepare(
    `INSERT INTO tournament_event_extras (tournament_id, event_id, bracket_json, pools_json)
     VALUES (?, ?, ?, ?)`,
  ).run(TID, eventId, bracket ? JSON.stringify(bracket) : null, JSON.stringify(pools ?? []));
}

const DRAW = {
  rounds: [
    {
      roundName: "Final",
      matches: [
        { side1Names: ["Sieger Sam (R2)"], side2Names: ["Zweiter Zoe (R3)"], result: "6:2 6:1", winnerSide: 1 },
      ],
    },
  ],
  championNames: ["Sieger Sam (R2)"],
};

const POOL = [
  {
    poolName: "Mixed",
    rows: [
      { rank: 2, names: ["Zweite Zoe", "Zweiter Zack"], matches: 3, victories: 2, sets: "", games: "" },
      { rank: 1, names: ["Erste Emma", "Erster Emil"], matches: 3, victories: 3, sets: "", games: "" },
    ],
  },
];

test("getWaidcupResults: Tableau liefert Sieger und unterlegenen Finalisten", () => {
  const db = openDatabase({ filePath: ":memory:" });
  addEvent(db, 1, "MS A R1/R5", "MS");
  addMatch(db, 1, "m1", "played");
  addExtras(db, 1, DRAW, []);

  const results = getWaidcupResults(db, TID);
  assert.equal(results.finished, true);
  assert.equal(results.events.length, 1);
  const e = results.events[0]!;
  assert.deepEqual(e.winnerNames, ["Sieger Sam (R2)"]);
  assert.deepEqual(e.runnerUpNames, ["Zweiter Zoe (R3)"]);
  assert.equal(e.discipline, "MS");
  db.close();
});

test("getWaidcupResults: Finalist ist die andere Seite, auch wenn Seite 2 gewinnt", () => {
  const db = openDatabase({ filePath: ":memory:" });
  addEvent(db, 1, "WS A R5/R9", "WS");
  addMatch(db, 1, "m1", "played");
  addExtras(
    db,
    1,
    {
      rounds: [
        {
          roundName: "Final",
          matches: [
            { side1Names: ["Verlor Vera"], side2Names: ["Gewann Gina"], result: "3:6 2:6", winnerSide: 2 },
          ],
        },
      ],
      championNames: ["Gewann Gina"],
    },
    [],
  );

  const e = getWaidcupResults(db, TID).events[0]!;
  assert.deepEqual(e.winnerNames, ["Gewann Gina"]);
  assert.deepEqual(e.runnerUpNames, ["Verlor Vera"]);
  db.close();
});

test("getWaidcupResults: Round-robin liefert Rang 1 und Rang 2 (Reihenfolge egal)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  addEvent(db, 1, "DM A R1/R5", "DM");
  addMatch(db, 1, "m1", "played");
  addExtras(db, 1, null, POOL);

  const e = getWaidcupResults(db, TID).events[0]!;
  assert.deepEqual(e.winnerNames, ["Erste Emma", "Erster Emil"]);
  assert.deepEqual(e.runnerUpNames, ["Zweite Zoe", "Zweiter Zack"]);
  db.close();
});

test("getWaidcupResults: solange eine Partie offen ist, gilt das Turnier nicht als beendet", () => {
  const db = openDatabase({ filePath: ":memory:" });
  addEvent(db, 1, "MS A R1/R5", "MS");
  addMatch(db, 1, "m1", "played");
  addMatch(db, 1, "m2", "open");
  addExtras(db, 1, DRAW, []);

  assert.deepEqual(getWaidcupResults(db, TID), { finished: false, events: [] });
  db.close();
});

test("getWaidcupResults: ohne Partien (noch nicht ausgelost) keine Übersicht", () => {
  const db = openDatabase({ filePath: ":memory:" });
  assert.deepEqual(getWaidcupResults(db, TID), { finished: false, events: [] });
  db.close();
});

test("getWaidcupResults: Konkurrenz ohne ermittelten Sieger fällt weg", () => {
  const db = openDatabase({ filePath: ":memory:" });
  addEvent(db, 1, "MS A R1/R5", "MS");
  addMatch(db, 1, "m1", "played");
  addExtras(db, 1, DRAW, []);
  // Zweite Konkurrenz: Tableau ohne Sieger (abgebrochen)
  addEvent(db, 2, "MS B", "MS");
  addExtras(db, 2, { rounds: [], championNames: [] }, []);

  const results = getWaidcupResults(db, TID);
  assert.deepEqual(results.events.map((e) => e.eventName), ["MS A R1/R5"]);
  db.close();
});
