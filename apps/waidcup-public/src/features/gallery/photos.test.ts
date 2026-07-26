import assert from "node:assert/strict";
import { test } from "node:test";
import { photosOf } from "./photos.js";

const YEAR = {
  year: 2026,
  days: [
    { day: "2026-07-18", images: ["a.webp", "b.webp"] },
    { day: "2026-07-25", images: ["c.webp"] },
  ],
};

test("photosOf: ohne Filter alle Bilder des Jahrgangs, chronologisch", () => {
  const photos = photosOf(YEAR, null);
  assert.deepEqual(photos.map((p) => p.id), ["2026-07-18/a.webp", "2026-07-18/b.webp", "2026-07-25/c.webp"]);
  assert.equal(photos[0]!.thumb, "/gallery/2026/2026-07-18/thumb/a.webp");
  assert.equal(photos[0]!.large, "/gallery/2026/2026-07-18/large/a.webp");
});

test("photosOf: Tagesfilter liefert nur Bilder dieses Tages", () => {
  const photos = photosOf(YEAR, "2026-07-25");
  assert.deepEqual(photos.map((p) => p.id), ["2026-07-25/c.webp"]);
  assert.equal(photos[0]!.day, "2026-07-25");
});

test("photosOf: Sonderzeichen im Dateinamen werden URL-kodiert", () => {
  const photos = photosOf({ year: 2026, days: [{ day: "2026-07-18", images: ["a b&c.webp"] }] }, null);
  assert.equal(photos[0]!.thumb, "/gallery/2026/2026-07-18/thumb/a%20b%26c.webp");
});

test("photosOf: ohne Jahrgang leere Liste (kein Absturz)", () => {
  assert.deepEqual(photosOf(undefined, null), []);
});
