import assert from "node:assert/strict";
import { test } from "node:test";
import { waidcupPersonKey } from "@tcw/shared";
import { openDatabase, type TcwDatabase } from "../db/connection.js";
import { setWaidcupCheckin } from "./waidcup-checkin-service.js";
import { setWaidcupPayment } from "./waidcup-payments-service.js";
import { getWaidcupDesk } from "./waidcup-desk-service.js";

const TID = 555001;
const DAY = "2026-07-24";

interface SeedMatch {
  key: string;
  date?: string;
  time?: string;
  p1?: string;
  p2?: string;
}

function seed(db: TcwDatabase, matches: SeedMatch[]): void {
  db.exec(
    `INSERT INTO tournament_events (tournament_id, event_id, tournament_name, event_name, discipline, source_descr, sort_order, updated_at)
     VALUES (${TID}, 1, 'Waidcup', 'MS A', 'MS', NULL, 0, 'x')`,
  );
  const insert = db.prepare(
    `INSERT INTO tournament_matches (
       tournament_id, event_id, match_key, tournament_name, event_name, mode,
       pool_name, round_name, scheduled_date, scheduled_time, court,
       player1_name, player1_name_2, player2_name, player2_name_2,
       result, status, winner_side, sort_order, updated_at
     ) VALUES (?, 1, ?, 'Waidcup', 'MS A', 'Draw', '', '', ?, ?, 'Platz 1', ?, '', ?, '', '', 'open', 0, 0, 'x')`,
  );
  for (const m of matches) {
    insert.run(TID, m.key, m.date ?? DAY, m.time ?? "10:00", m.p1 ?? "A", m.p2 ?? "B");
  }
}

test("getWaidcupDesk: führt turnierweite Kosten/Status mit tagesbezogener Anwesenheit zusammen", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    // spielt heute
    { key: "m1", date: DAY, time: "09:00", p1: "Weiss Xenia (R5)", p2: "Roth Anna (R6)" },
    // spielt erst morgen
    { key: "m2", date: "2026-07-25", time: "11:00", p1: "Berg Tom (R4)", p2: "See Jan (R4)" },
  ]);
  setWaidcupCheckin(db, TID, waidcupPersonKey("Weiss Xenia (R5)"), DAY, true, "2026-07-24T08:00:00Z");
  setWaidcupPayment(db, TID, waidcupPersonKey("Berg Tom (R4)"), "paid", "2026-07-20T08:00:00Z");

  const desk = getWaidcupDesk(db, TID, DAY);
  const xenia = desk.persons.find((p) => p.name === "Weiss Xenia")!;
  const tom = desk.persons.find((p) => p.name === "Berg Tom")!;

  // Xenia: spielt heute, eingecheckt, noch offen (Einzel CHF 60).
  assert.equal(xenia.playsToday, true);
  assert.equal(xenia.todayMatchTime, "09:00");
  assert.equal(xenia.todayMatchCourt, "Platz 1");
  assert.equal(xenia.present, true);
  assert.equal(xenia.status, "open");
  assert.equal(xenia.cost, 60);
  // Tom: bezahlt, spielt heute nicht → keine Anwesenheit heute.
  assert.equal(tom.playsToday, false);
  assert.equal(tom.present, false);
  assert.equal(tom.status, "paid");

  // Turnierweite Totals: 3 offene à 60 (Xenia, Roth, See) + Tom bezahlt.
  assert.equal(desk.totalPaid, 60);
  assert.equal(desk.totalOpen, 180);
  assert.equal(desk.day, DAY);
  db.close();
});
