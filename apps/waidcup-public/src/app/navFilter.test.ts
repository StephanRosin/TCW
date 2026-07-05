import assert from "node:assert/strict";
import { test } from "node:test";
import type { NavItem } from "./navigation.js";
import { filterNavForViewport } from "./navFilter.js";

const ITEMS: NavItem[] = [
  { view: "location", labelKey: "nav.location" },
  { view: "tour", labelKey: "nav.tour" },
  { view: "live", labelKey: "nav.live" },
];

test("filterNavForViewport: Desktop behält alle Einträge inkl. tour", () => {
  const result = filterNavForViewport(ITEMS, false);
  assert.equal(result.length, 3);
  assert.ok(result.some((i) => i.view === "tour"));
});

test("filterNavForViewport: Mobile entfernt nur den tour-Eintrag", () => {
  const result = filterNavForViewport(ITEMS, true);
  assert.equal(result.length, 2);
  assert.ok(!result.some((i) => i.view === "tour"));
  assert.ok(result.some((i) => i.view === "live"));
});
