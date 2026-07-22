import assert from "node:assert/strict";
import { test } from "node:test";
import { waidcupPersonKey } from "@tcw/shared";
import { openDatabase, type TcwDatabase } from "../db/connection.js";
import {
  getWaidcupCheckin,
  readPresentPersonKeys,
  setWaidcupCheckin,
} from "./waidcup-checkin-service.js";

const TID = 777001;
const DAY = "2026-07-21";

interface SeedMatch {
  key: string;
  date?: string;
  time?: string;
  p1?: string;
  p1b?: string | null;
  p2?: string;
  p2b?: string | null;
}

function seed(db: TcwDatabase, matches: SeedMatch[]): void {
  const insert = db.prepare(
    `INSERT INTO tournament_matches (
       tournament_id, event_id, match_key, tournament_name, event_name, mode,
       pool_name, round_name, scheduled_date, scheduled_time, court,
       player1_name, player1_name_2, player2_name, player2_name_2,
       result, status, winner_side, sort_order, updated_at
     ) VALUES (?, 1, ?, 'Waidcup', 'MS A', 'Draw', '', '', ?, ?, 'Platz 1', ?, ?, ?, ?, '', 'open', 0, 0, 'x')`,
  );
  for (const m of matches) {
    insert.run(TID, m.key, m.date ?? DAY, m.time ?? "10:00", m.p1 ?? "A", m.p1b ?? "", m.p2 ?? "B", m.p2b ?? "");
  }
}

test("getWaidcupCheckin: listet nur heutige Spieler, distinct, früheste Zeit", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { key: "m1", time: "18:00", p1: "Weiss Xenia (R5)", p2: "Roth Anna (R6)" },
    // gleiche Person früher am Tag → früheste Zeit gewinnt
    { key: "m2", time: "09:00", p1: "Weiss Xenia (R5)", p2: "Kunz Eva (R7)" },
    // anderer Tag → nicht in der Liste
    { key: "m3", date: "2026-07-22", p1: "Berg Tom (R4)", p2: "See Jan (R4)" },
  ]);

  const board = getWaidcupCheckin(db, TID, DAY);
  const names = board.persons.map((p) => p.name);
  assert.deepEqual(names.sort(), ["Kunz Eva", "Roth Anna", "Weiss Xenia"]);
  assert.equal(board.persons.find((p) => p.name === "Weiss Xenia")?.matchTime, "09:00");
  assert.equal(board.totalCount, 3);
  assert.equal(board.presentCount, 0);
  assert.ok(!names.includes("Berg Tom")); // Folgetag nicht enthalten
  db.close();
});

test("setWaidcupCheckin: an-/abwählen setzt/entfernt die Anwesenheit für den Tag", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [{ key: "m1", p1: "Weiss Xenia (R5)", p2: "Roth Anna (R6)" }]);
  const key = waidcupPersonKey("Weiss Xenia (R5)");

  setWaidcupCheckin(db, TID, key, DAY, true, "2026-07-21T09:00:00Z");
  let board = getWaidcupCheckin(db, TID, DAY);
  assert.equal(board.presentCount, 1);
  assert.equal(board.persons.find((p) => p.personKey === key)?.present, true);
  assert.deepEqual([...readPresentPersonKeys(db, TID, DAY)], [key]);

  setWaidcupCheckin(db, TID, key, DAY, false, "2026-07-21T10:00:00Z");
  board = getWaidcupCheckin(db, TID, DAY);
  assert.equal(board.presentCount, 0);
  assert.equal(readPresentPersonKeys(db, TID, DAY).size, 0);
  db.close();
});

test("Check-In ist tagesbezogen: Anwesenheit an einem Tag gilt nicht am anderen", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { key: "m1", date: DAY, p1: "Weiss Xenia (R5)", p2: "Roth Anna (R6)" },
    { key: "m2", date: "2026-07-22", p1: "Weiss Xenia (R5)", p2: "Kunz Eva (R7)" },
  ]);
  const key = waidcupPersonKey("Weiss Xenia (R5)");
  setWaidcupCheckin(db, TID, key, DAY, true, "2026-07-21T09:00:00Z");

  assert.equal(getWaidcupCheckin(db, TID, DAY).persons.find((p) => p.personKey === key)?.present, true);
  assert.equal(getWaidcupCheckin(db, TID, "2026-07-22").persons.find((p) => p.personKey === key)?.present, false);
  db.close();
});
