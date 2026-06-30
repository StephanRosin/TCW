import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCourtBlocks } from "./occupancy.js";
import type { GotCourtsReservationList } from "./client.js";

// Belegung wie morgen 2026-07-01 (Sekunden ab Mitternacht).
const SAMPLE: GotCourtsReservationList = {
  courts: [
    { id: 1, label: "Platz 1" },
    { id: 2, label: "Platz 2" },
    { id: 3, label: "Platz 3" },
    { id: 4, label: "Platz 4" },
    { id: 5, label: "Platz 5" },
    { id: 6, label: "Platz 6" },
  ],
  reservations: [
    {
      courtId: 1,
      startTime: 19 * 3600,
      endTime: 21 * 3600,
      text: "Clubmeisterschaften",
      shortDesc: "Clubmeisterschaften",
      player: { shortName: "M. Muster" },
      partners: [{ shortName: "A. Pennisi", name: "Alba Pennisi" }],
    },
    {
      courtId: 2,
      startTime: 18 * 3600,
      endTime: 20 * 3600,
      text: "Clubmeisterschaften",
      shortDesc: "Clubmeisterschaften",
      // Bucher ohne shortName -> aus Vor-/Nachname gebildet (J. Dennler).
      player: { fullName: "Jonas Dennler", firstname: "Jonas", lastname: "Dennler" },
      partners: [{ shortName: "C. KALAYCI" }],
    },
    {
      courtId: 3,
      startTime: 19 * 3600,
      endTime: 21 * 3600,
      text: "J. Lanker",
      shortDesc: "-",
      partners: [
        { shortName: "S. Haubensak" },
        { shortName: "A. Casanova" },
        { shortName: "A. Diercksen" },
      ],
    },
    {
      courtId: 4,
      startTime: 19 * 3600,
      endTime: 20 * 3600,
      text: "A. Mraz",
      shortDesc: "-",
      owner: { fullName: "Alexandra Mraz", firstname: "Alexandra", lastname: "Mraz" },
      partners: [{ shortName: "M. Mraz" }],
    },
    { courtId: 5, startTime: 19 * 3600, endTime: 21 * 3600, text: "Tennisschule (Nicolas)", shortDesc: "Tennisschule (Nicolas)" },
    { courtId: 6, startTime: 18 * 3600, endTime: 22 * 3600, text: "Tennisschule (Seraphine)", shortDesc: "Tennisschule (Seraphine)" },
  ],
  blockings: [],
};

test("buildCourtBlocks um 19:30: aktuelle Stunde zeigt alle sechs belegten Plätze", () => {
  const blocks = buildCourtBlocks(SAMPLE, 19 * 3600 + 30 * 60);
  const live = blocks[0]!;
  assert.equal(live.live, true);
  assert.equal(live.label, "19:00–20:00");
  assert.equal(live.bookings.length, 6);
  // Vereinsanlass: Titel plus Bucher (player) UND Mitspieler.
  assert.equal(live.bookings[0]!.who, "Clubmeisterschaften · M. Muster, A. Pennisi");
  // Bucher ohne shortName wird aus Vor-/Nachname gebildet.
  assert.equal(live.bookings[1]!.who, "Clubmeisterschaften · J. Dennler, C. KALAYCI");
  // Mitgliederbuchung: Hauptbucher (text) und ALLE Mitspieler.
  assert.equal(live.bookings[2]!.who, "J. Lanker, S. Haubensak, A. Casanova, A. Diercksen");
  // Bucher aus owner-Objekt (A. Mraz) plus Mitspieler.
  assert.equal(live.bookings[3]!.who, "A. Mraz, M. Mraz");
});

test("buildCourtBlocks um 19:30: Folgestunde 20:00–21:00 nur mit noch laufenden Buchungen", () => {
  const blocks = buildCourtBlocks(SAMPLE, 19 * 3600 + 30 * 60);
  assert.equal(blocks.length, 2);
  const next = blocks[1]!;
  assert.equal(next.live, false);
  assert.equal(next.label, "20:00–21:00");
  // Platz 2 (bis 20:00) und Platz 4 (bis 20:00) sind dann zu Ende.
  assert.deepEqual(
    next.bookings.map((b) => b.court),
    ["Platz 1", "Platz 3", "Platz 5", "Platz 6"],
  );
});

test("buildCourtBlocks ohne Folgebuchungen liefert nur den Live-Block", () => {
  const blocks = buildCourtBlocks(SAMPLE, 21 * 3600 + 30 * 60); // 21:30, nur Platz 6 bis 22:00
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.bookings.length, 1);
  assert.equal(blocks[0]!.bookings[0]!.court, "Platz 6");
});

test("buildCourtBlocks nachts: Live-Block bleibt, ist aber leer", () => {
  const blocks = buildCourtBlocks(SAMPLE, 3 * 3600);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.live, true);
  assert.equal(blocks[0]!.bookings.length, 0);
});
