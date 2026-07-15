import assert from "node:assert/strict";
import { test } from "node:test";
import type { PlanDay } from "./planData.js";
import { findByName, matchedDayKeys, splitNames } from "./search.js";

const SLOTS = ["08:30–09:30", "09:30–10:30"];
const DAYS: PlanDay[] = [
  {
    key: "sa-18",
    weekdayKey: "helpers.weekday.sat",
    date: "18.07.2026",
    label: { key: "helpers.day.matchday", n: "1" },
    cells: {
      "08:30–09:30": { lines: [{ role: "bar", names: "Victoria H." }] },
      "09:30–10:30": { lines: [{ role: "grill", names: "Tim; Florine; Allison" }] },
    },
  },
  {
    key: "mo-20",
    weekdayKey: "helpers.weekday.mon",
    date: "20.07.2026",
    label: { key: "helpers.day.matchday", n: "3" },
    cells: {
      "08:30–09:30": { lines: [{ role: "springer", names: "Tom?" }] },
    },
  },
];

test("splitNames trennt an ; und , und trimmt", () => {
  assert.deepEqual(splitNames("Tim; Florine, Allison"), ["Tim", "Florine", "Allison"]);
  assert.deepEqual(splitNames("  "), []);
});

test("findByName findet Teiltreffer über mehrere Tage", () => {
  const hits = findByName(DAYS, SLOTS, "flor");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.name, "Florine");
  assert.equal(hits[0]!.dayKey, "sa-18");
  assert.equal(hits[0]!.slot, "09:30–10:30");
  assert.equal(hits[0]!.roleKey, "grill");
});

test("findByName ignoriert Zusatzzeichen wie ? und .", () => {
  assert.equal(findByName(DAYS, SLOTS, "tom").length, 1);
  assert.equal(findByName(DAYS, SLOTS, "victoria h").length, 1);
});

test("findByName ist case-insensitive und leer bei leerer Suche", () => {
  assert.equal(findByName(DAYS, SLOTS, "VICTORIA").length, 1);
  assert.equal(findByName(DAYS, SLOTS, "   ").length, 0);
});

test("matchedDayKeys liefert die betroffenen Tage", () => {
  const keys = matchedDayKeys(findByName(DAYS, SLOTS, "o"));
  assert.ok(keys.has("sa-18"));
  assert.ok(keys.has("mo-20"));
});
