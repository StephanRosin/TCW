import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlanDay } from "./planData.js";
import { currentDayKey } from "./today.js";

function day(key: string, date: string): PlanDay {
  return { key, weekdayKey: "helpers.weekday.sat", date, label: { key: "helpers.day.matchday" }, cells: {} };
}

const DAYS: readonly PlanDay[] = [
  day("fr-17", "17.07.2026"),
  day("sa-18", "18.07.2026"),
  day("so-26", "26.07.2026"),
];

test("currentDayKey: heutiger Plantag wird gefunden", () => {
  assert.equal(currentDayKey(DAYS, new Date(2026, 6, 18, 9, 0)), "sa-18");
  // Auch spät am Abend noch derselbe Tag (kein Umschlag durch Uhrzeit)
  assert.equal(currentDayKey(DAYS, new Date(2026, 6, 18, 23, 59)), "sa-18");
  assert.equal(currentDayKey(DAYS, new Date(2026, 6, 26, 0, 1)), "so-26");
});

test("currentDayKey: ausserhalb des Turniers gibt es keinen aktuellen Tag", () => {
  assert.equal(currentDayKey(DAYS, new Date(2026, 6, 16, 12, 0)), null); // davor
  assert.equal(currentDayKey(DAYS, new Date(2026, 6, 19, 12, 0)), null); // Lücke
  assert.equal(currentDayKey(DAYS, new Date(2026, 6, 27, 12, 0)), null); // danach
  assert.equal(currentDayKey(DAYS, new Date(2027, 6, 18, 12, 0)), null); // anderes Jahr
});

test("currentDayKey: Monat und Tag werden nicht verwechselt", () => {
  // 07.06. darf nicht auf den 06.07. passen
  const tricky = [day("x", "07.06.2026")];
  assert.equal(currentDayKey(tricky, new Date(2026, 6, 6, 12, 0)), null);
  assert.equal(currentDayKey(tricky, new Date(2026, 5, 7, 12, 0)), "x");
});

test("currentDayKey: unbrauchbares Datum wird ignoriert, leere Liste liefert null", () => {
  assert.equal(currentDayKey([day("kaputt", "morgen")], new Date(2026, 6, 18)), null);
  assert.equal(currentDayKey([], new Date(2026, 6, 18)), null);
});
