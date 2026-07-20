import assert from "node:assert/strict";
import { test } from "node:test";
import type { TournamentBracket } from "@tcw/shared";
import { openDatabase, type TcwDatabase } from "../../db/connection.js";
import { applyReservations, mapCourtRequestToReservation, type CourtRequestRow } from "./reservations.js";

const CM = 158133;

function row(overrides: Partial<CourtRequestRow>): CourtRequestRow {
  return {
    tournament_id: CM,
    event_id: 829486,
    match_id: "4491546",
    req_datetime: "2026-08-14T09:00",
    court_nb: 1,
    ...overrides,
  };
}

test("mapCourtRequestToReservation: Round-robin-Match → rr-Key", () => {
  const reservation = mapCourtRequestToReservation(row({ match_id: "4491546" }));
  assert.deepEqual(reservation, {
    tournamentId: CM,
    eventId: 829486,
    matchKey: "rr:829486:4491546",
    isDraw: false,
    level: -1,
    position: -1,
    date: "2026-08-14",
    time: "09:00",
    court: "Platz 1",
  });
});

test("mapCourtRequestToReservation: Tableau-Match 'L_P' → draw-Key mit level/position", () => {
  const reservation = mapCourtRequestToReservation(row({ match_id: "2_3", court_nb: 5 }));
  assert.equal(reservation?.matchKey, "draw:829486:2:3");
  assert.equal(reservation?.isDraw, true);
  assert.equal(reservation?.level, 2);
  assert.equal(reservation?.position, 3);
  assert.equal(reservation?.court, "Platz 5");
});

test("mapCourtRequestToReservation: ohne Termin → null", () => {
  assert.equal(mapCourtRequestToReservation(row({ req_datetime: null })), null);
  assert.equal(mapCourtRequestToReservation(row({ req_datetime: "" })), null);
});

test("mapCourtRequestToReservation: ohne Platznummer → leerer Platz", () => {
  assert.equal(mapCourtRequestToReservation(row({ court_nb: null }))?.court, "");
});

function insertMatch(database: TcwDatabase, matchKey: string, status: string): void {
  database
    .prepare(
      `INSERT INTO tournament_matches
        (tournament_id, event_id, match_key, tournament_name, event_name, mode,
         player1_name, player2_name, status, updated_at)
       VALUES (@t, @e, @k, 'CM', 'HE', 'Draw', 'A', 'B', @s, '2026-08-01T00:00')`,
    )
    .run({ t: CM, e: 829486, k: matchKey, s: status });
}

function readMatch(database: TcwDatabase, matchKey: string): { date: string | null; time: string | null; court: string | null } {
  return database
    .prepare(
      `SELECT scheduled_date AS date, scheduled_time AS time, court
       FROM tournament_matches WHERE tournament_id = ? AND event_id = ? AND match_key = ?`,
    )
    .get(CM, 829486, matchKey) as { date: string | null; time: string | null; court: string | null };
}

test("applyReservations: offenes rr-Match bekommt Datum/Zeit/Platz", () => {
  const database = openDatabase({ filePath: ":memory:" });
  insertMatch(database, "rr:829486:4491546", "open");
  const reservation = mapCourtRequestToReservation(row({}))!;

  const result = applyReservations(database, [reservation]);

  assert.equal(result.matchesUpdated, 1);
  assert.deepEqual(readMatch(database, "rr:829486:4491546"), {
    date: "2026-08-14",
    time: "09:00",
    court: "Platz 1",
  });
  database.close();
});

test("applyReservations: gespieltes Match bleibt unberührt (nur status='open')", () => {
  const database = openDatabase({ filePath: ":memory:" });
  insertMatch(database, "rr:829486:4491546", "played");
  const reservation = mapCourtRequestToReservation(row({}))!;

  const result = applyReservations(database, [reservation]);

  assert.equal(result.matchesUpdated, 0);
  assert.deepEqual(readMatch(database, "rr:829486:4491546"), { date: null, time: null, court: null });
  database.close();
});

test("applyReservations: Tableau-Knoten (rounds[len-1-level].matches[position]) wird gesetzt", () => {
  const database = openDatabase({ filePath: ":memory:" });
  insertMatch(database, "draw:829486:1:0", "open");
  // 3 Runden (Halbfinale/Final/Sieger-Struktur): level 1 → roundIndex = 3-1-1 = 1.
  const bracket: TournamentBracket = {
    championNames: [],
    rounds: [
      { roundName: "Viertelfinal", matches: [] },
      {
        roundName: "Halbfinal",
        matches: [
          { side1Names: ["A"], side2Names: ["B"], result: "", winnerSide: 0 },
          { side1Names: ["C"], side2Names: ["D"], result: "6:0 6:0", winnerSide: 1 },
        ],
      },
      { roundName: "Final", matches: [] },
    ],
  };
  database
    .prepare(
      `INSERT INTO tournament_event_extras (tournament_id, event_id, pools_json, bracket_json)
       VALUES (?, ?, '[]', ?)`,
    )
    .run(CM, 829486, JSON.stringify(bracket));

  const openNode = mapCourtRequestToReservation(row({ match_id: "1_0" }))!;
  const playedNode = mapCourtRequestToReservation(row({ match_id: "1_1", req_datetime: "2026-08-15T14:00" }))!;

  const result = applyReservations(database, [openNode, playedNode]);

  assert.equal(result.bracketNodesUpdated, 1); // nur der offene Knoten
  const stored = JSON.parse(
    (database.prepare(`SELECT bracket_json FROM tournament_event_extras WHERE tournament_id = ? AND event_id = ?`).get(CM, 829486) as { bracket_json: string }).bracket_json,
  ) as TournamentBracket;
  assert.equal(stored.rounds[1]!.matches[0]!.scheduledDate, "2026-08-14");
  assert.equal(stored.rounds[1]!.matches[0]!.scheduledTime, "09:00");
  assert.equal(stored.rounds[1]!.matches[0]!.court, "Platz 1");
  // gespielter Knoten unverändert (kein Termin gesetzt)
  assert.equal(stored.rounds[1]!.matches[1]!.scheduledDate, undefined);
  database.close();
});
