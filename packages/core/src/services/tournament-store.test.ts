import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../db/connection.js";
import { replaceTournamentData, type EventImport } from "./tournament-store.js";

function registration(playerKey: string, note: string | null) {
  return {
    playerKey,
    playerName: `Player ${playerKey}`,
    playerName2: null,
    firstName: "Player",
    lastName: playerKey,
    firstName2: "",
    lastName2: "",
    licenseNumber: null,
    licenseNumber2: null,
    confirmed: 1,
    ranking: "R5",
    ranking2: null,
    registeredOn: "01.05.2026",
    registeredOnSort: "2026-05-01T00:00:00",
    note,
    sortOrder: 0,
    playerUrl: "",
    playerUrl2: "",
  };
}

test("replaceTournamentData speichert auch Spieler ohne Notiz (kein OR-IGNORE-Verlust)", () => {
  const database = openDatabase({ filePath: ":memory:" });
  const events: EventImport[] = [
    {
      meta: { eventId: 1, eventName: "WS A R1/R5", discipline: "WS", mode: "Draw", matchTypeId: 2, sortOrder: 0 },
      registrations: [registration("a", null), registration("b", "Kommentar"), registration("c", null)],
      matches: [],
      pools: [],
      bracket: null,
    },
  ];

  replaceTournamentData(database, 158138, "Waidcup", events, "2026-06-26T00:00:00Z");

  const count = database
    .prepare("SELECT COUNT(*) AS total FROM tournament_players WHERE tournament_id = 158138")
    .get() as { total: number };
  assert.equal(count.total, 3);
  database.close();
});
