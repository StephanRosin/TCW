import assert from "node:assert/strict";
import { test } from "node:test";
import { playerNameKey } from "@tcw/shared";
import { openDatabase, type TcwDatabase } from "../db/connection.js";
import { upsertPlayer } from "./player-registry.js";
import {
  getWaidcupLive,
  getWaidcupMatches,
  getWaidcupOrderOfPlay,
  getWaidcupPlayerUrls,
} from "./waidcup-service.js";

const TID = 999001;
// Fester Bezugszeitpunkt für deterministische Tests: 2026-07-04, 14:30 lokal.
const NOW = new Date(2026, 6, 4, 14, 30, 0);

interface SeedMatch {
  key: string;
  event?: string;
  court?: string;
  date?: string;
  time?: string;
  status?: "open" | "played";
  result?: string;
  p1?: string;
  p2?: string;
  mode?: string;
  round?: string;
}

function seed(db: TcwDatabase, matches: SeedMatch[]): void {
  const insert = db.prepare(
    `INSERT INTO tournament_matches (
       tournament_id, event_id, match_key, tournament_name, event_name, mode,
       pool_name, round_name, scheduled_date, scheduled_time, court,
       player1_name, player1_name_2, player2_name, player2_name_2,
       result, status, winner_side, sort_order, updated_at
     ) VALUES (?, 1, ?, 'Waidcup (Test)', ?, ?, '', ?, ?, ?, ?, ?, '', ?, '', ?, ?, 0, 0, 'x')`,
  );
  for (const m of matches) {
    insert.run(
      TID,
      m.key,
      m.event ?? "MS A",
      m.mode ?? "Draw",
      m.round ?? "",
      m.date ?? "",
      m.time ?? "",
      m.court ?? "",
      m.p1 ?? "Spieler Eins (R5)",
      m.p2 ?? "Spieler Zwei (R6)",
      m.result ?? "",
      m.status ?? "open",
    );
  }
}

test("getWaidcupLive: heute + Startzeit erreicht = live (nach Platz sortiert), Zukunft = upcoming (nach Zeit)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { key: "live-p10", date: "2026-07-04", time: "14:00", court: "Platz 10" },
    { key: "live-p2", date: "2026-07-04", time: "13:30", court: "Platz 2" },
    { key: "up-later-today", date: "2026-07-04", time: "16:00", court: "Platz 1" },
    { key: "up-soon-today", date: "2026-07-04", time: "15:00", court: "Platz 3" },
    { key: "up-tomorrow-p1", date: "2026-07-05", time: "09:00", court: "Platz 1" },
    // Platz 7 hat NUR morgen eine Partie – darf nicht in „Als Nächstes"
    { key: "up-tomorrow-only", date: "2026-07-05", time: "09:00", court: "Platz 7" },
    { key: "no-schedule" }, // ohne Termin: weder live noch upcoming
    // Platzhalter ("Sieger aus ..." = leere Namen): darf nirgends erscheinen
    { key: "placeholder", date: "2026-07-05", time: "10:00", court: "Platz 2", p1: "", p2: "" },
  ]);

  const board = getWaidcupLive(db, TID, NOW);
  // Live: Platz 2 vor Platz 10 (natürliche Sortierung, nicht alphabetisch)
  assert.deepEqual(board.now.map((m) => m.court), ["Platz 2", "Platz 10"]);
  // Upcoming: nur heutige Partien, pro Platz die zeitlich nächste, nach Platz
  // sortiert. Platz 1 hat heute 16:00 (+ morgen 09:00 → verworfen), Platz 7 hat
  // NUR morgen → erscheint gar nicht.
  assert.deepEqual(
    board.upcoming.map((m) => `${m.court} ${m.scheduledDate} ${m.scheduledTime}`),
    ["Platz 1 2026-07-04 16:00", "Platz 3 2026-07-04 15:00"],
  );
  db.close();
});

test("getWaidcupLive: Resultat erfasst → Partie verschwindet aus live; gestrige offene Partien erscheinen nicht", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { key: "finished", date: "2026-07-04", time: "13:00", court: "Platz 1", status: "played", result: "6:2 6:3" },
    { key: "stale-yesterday", date: "2026-07-03", time: "18:00", court: "Platz 4" },
    { key: "really-live", date: "2026-07-04", time: "14:15", court: "Platz 5" },
    // Vorherige Partie ohne erfasstes Resultat: die neuere verdrängt sie
    { key: "superseded", date: "2026-07-04", time: "12:00", court: "Platz 5" },
  ]);

  const board = getWaidcupLive(db, TID, NOW);
  assert.deepEqual(
    board.now.map((m) => `${m.court} ${m.scheduledTime}`),
    ["Platz 5 14:15"],
  );
  assert.equal(board.upcoming.length, 0);
  db.close();
});

test("getWaidcupLive: Partie ohne Resultat faellt nach der Zeitobergrenze aus live", () => {
  const db = openDatabase({ filePath: ":memory:" });
  // NOW = 14:30, Obergrenze 3h → Fenster ab 11:30.
  seed(db, [
    { key: "stale-no-result", date: "2026-07-04", time: "11:00", court: "Platz 8" }, // 3.5h her → raus
    { key: "still-live", date: "2026-07-04", time: "13:00", court: "Platz 9" }, // 1.5h her → live
  ]);

  const board = getWaidcupLive(db, TID, NOW);
  assert.deepEqual(
    board.now.map((m) => `${m.court} ${m.scheduledTime}`),
    ["Platz 9 13:00"],
  );
  db.close();
});

test("getWaidcupMatches: liefert nur Matches des konfigurierten Turniers", () => {
  const db = openDatabase({ filePath: ":memory:" });
  db.exec(
    `INSERT INTO tournament_events (tournament_id, event_id, tournament_name, event_name, discipline, source_descr, sort_order, updated_at)
     VALUES (${TID}, 1, 'Waidcup (Test)', 'MS A', 'MS', NULL, 0, 'x'), (12345, 1, 'Anderes', 'WS A', 'WS', NULL, 0, 'x')`,
  );
  seed(db, [{ key: "m1", date: "2026-07-04", time: "10:00", status: "played", result: "6:0 6:0" }]);
  db.exec(
    `INSERT INTO tournament_matches (tournament_id, event_id, match_key, tournament_name, event_name, mode, pool_name, round_name, scheduled_date, scheduled_time, court, player1_name, player2_name, result, status, winner_side, sort_order, updated_at)
     VALUES (12345, 1, 'fremd', 'Anderes', 'WS A', 'Draw', '', '', '', '', '', 'X', 'Y', '', 'open', 0, 0, 'x')`,
  );

  const matches = getWaidcupMatches(db, TID);
  assert.equal(matches.length, 1);
  assert.equal(matches[0]!.matchKey, "m1");
  db.close();
});

test("getWaidcupOrderOfPlay: Draw behält die Runde, Round-robin zeigt nur den Event (roundName leer)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db, [
    { key: "draw", event: "MS R1/R5", mode: "Draw", round: "Viertelfinal", date: "2026-07-04", time: "10:00", court: "Platz 1" },
    { key: "rr", event: "DM A R1/R5", mode: "Round-robin", round: "Mixed", date: "2026-07-04", time: "11:00", court: "Platz 2" },
  ]);

  const board = getWaidcupOrderOfPlay(db, TID, NOW);
  const draw = board.find((m) => m.court === "Platz 1");
  const rr = board.find((m) => m.court === "Platz 2");
  // Draw: Runde bleibt → Zeile „MS R1/R5 Viertelfinal".
  assert.equal(draw?.roundName, "Viertelfinal");
  assert.equal(draw?.eventName, "MS R1/R5");
  // Round-robin: Gruppe („Mixed") wird nicht als Runde geführt → nur der Event.
  assert.equal(rr?.roundName, "");
  assert.equal(rr?.eventName, "DM A R1/R5");
  db.close();
});

test("getWaidcupPlayerUrls: löst über das Register auf (auch quellenübergreifend)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  // Waidcup-Match nennt den Spieler, die URL kommt aber aus dem Register (z. B. Kader),
  // nicht aus tournament_players des Turniers.
  upsertPlayer(db, {
    name: "Rauch Markus (R4)",
    url: "https://www.mytennis.ch/de/spieler/177712",
    member: true,
    memberSource: "roster",
  });
  seed(db, [{ key: "m-registry", p1: "Rauch Markus (R4)", p2: "Aepli Daniel (R4)" }]);

  const map = getWaidcupPlayerUrls(db, TID);
  assert.equal(map[playerNameKey("Markus Rauch")], "https://www.mytennis.ch/de/spieler/177712");
  db.close();
});
