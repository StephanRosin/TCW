import assert from "node:assert/strict";
import { test } from "node:test";
import type { WaidcupLiveMatch } from "@tcw/shared";
import { buildGrid, formatTimeBand } from "./OrderOfPlaySchedule.js";

function match(overrides: Partial<WaidcupLiveMatch>): WaidcupLiveMatch {
  return {
    court: "Platz 3",
    eventName: "MS R1/R5",
    roundName: "Achtelfinal",
    side1Names: ["A (R5)"],
    side2Names: ["B (R5)"],
    scheduledDate: "2026-07-25",
    scheduledTime: "10:00",
    result: "",
    winnerSide: 0,
    ...overrides,
  };
}

test("buildGrid (Standard): feste Spalten 1…max(6, höchster Platz)", () => {
  const grid = buildGrid([match({ court: "Platz 2" }), match({ court: "Platz 4" })]);
  assert.deepEqual(grid.courts, [1, 2, 3, 4, 5, 6]);
});

test("buildGrid (Standard): erweitert über 6 hinaus, wenn ein höherer Platz belegt ist", () => {
  const grid = buildGrid([match({ court: "Platz 8" })]);
  assert.deepEqual(grid.courts, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("buildGrid (occupiedOnly): nur belegte Plätze, sortiert, ohne Lücken", () => {
  const grid = buildGrid(
    [match({ court: "Platz 4" }), match({ court: "Platz 2", scheduledTime: "11:00" }), match({ court: "Platz 4", scheduledTime: "11:00" })],
    { occupiedOnly: true },
  );
  assert.deepEqual(grid.courts, [2, 4]);
});

test("buildGrid (occupiedOnly): Platz 0 / ohne Nummer wird nicht als Spalte geführt", () => {
  const grid = buildGrid([match({ court: "" }), match({ court: "Platz 3" })], { occupiedOnly: true });
  assert.deepEqual(grid.courts, [3]);
});

test("buildGrid: Zeiten dedupliziert und aufsteigend sortiert", () => {
  const grid = buildGrid([match({ scheduledTime: "14:00" }), match({ scheduledTime: "09:00" }), match({ scheduledTime: "14:00" })]);
  assert.deepEqual(grid.times, ["09:00", "14:00"]);
});

test("formatTimeBand: sprachtypische Uhrzeit (de Uhr, en 12h AM/PM, fr h, it ore)", () => {
  assert.equal(formatTimeBand("18:00", "de"), "18:00 Uhr");
  assert.equal(formatTimeBand("09:00", "de"), "09:00 Uhr");
  assert.equal(formatTimeBand("18:00", "en"), "6:00 PM");
  assert.equal(formatTimeBand("19:30", "en"), "7:30 PM");
  assert.equal(formatTimeBand("09:00", "en"), "9:00 AM");
  assert.equal(formatTimeBand("00:15", "en"), "12:15 AM");
  assert.equal(formatTimeBand("12:00", "en"), "12:00 PM");
  assert.equal(formatTimeBand("18:00", "fr"), "18h00");
  assert.equal(formatTimeBand("09:05", "fr"), "09h05");
  assert.equal(formatTimeBand("18:00", "it"), "ore 18:00");
  // Ungültige Eingabe bleibt unverändert.
  assert.equal(formatTimeBand("", "en"), "");
});
