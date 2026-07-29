import assert from "node:assert/strict";
import { test } from "node:test";
import { photosOf } from "./photos.js";

const YEAR = {
  year: 2026,
  days: [
    { day: "2026-07-18", images: ["a.webp", "b.webp"], version: "abc" },
    { day: "2026-07-25", images: ["c.webp"], version: "xyz" },
  ],
};

test("photosOf: ohne Filter alle Bilder des Jahrgangs, chronologisch", () => {
  const photos = photosOf(YEAR, null);
  assert.deepEqual(photos.map((p) => p.id), ["2026-07-18/a.webp", "2026-07-18/b.webp", "2026-07-25/c.webp"]);
  assert.equal(photos[0]!.thumb, "/gallery/2026/2026-07-18/thumb/a.webp?v=abc");
  assert.equal(photos[0]!.large, "/gallery/2026/2026-07-18/large/a.webp?v=abc");
});

test("photosOf: Tagesfilter liefert nur Bilder dieses Tages", () => {
  const photos = photosOf(YEAR, "2026-07-25");
  assert.deepEqual(photos.map((p) => p.id), ["2026-07-25/c.webp"]);
  assert.equal(photos[0]!.day, "2026-07-25");
});

test("photosOf: Sonderzeichen im Dateinamen werden URL-kodiert", () => {
  const photos = photosOf(
    { year: 2026, days: [{ day: "2026-07-18", images: ["a b&c.webp"], version: "v1" }] },
    null,
  );
  assert.equal(photos[0]!.thumb, "/gallery/2026/2026-07-18/thumb/a%20b%26c.webp?v=v1");
});

test("photosOf: ohne Jahrgang leere Liste (kein Absturz)", () => {
  assert.deepEqual(photosOf(undefined, null), []);
});

test("photosOf: jeder Tag bringt sein eigenes Versionskennzeichen mit", () => {
  const photos = photosOf(YEAR, null);
  assert.match(photos[0]!.thumb, /\?v=abc$/); // 18.07.
  assert.match(photos.at(-1)!.large, /\?v=xyz$/); // 25.07.
});

test("photosOf: Download bekommt einen sprechenden Dateinamen", () => {
  const photos = photosOf(YEAR, "2026-07-25");
  assert.equal(photos[0]!.downloadName, "waidcup-2026-07-25-c.webp");
});
