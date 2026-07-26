import assert from "node:assert/strict";
import { test } from "node:test";
import { formatGalleryDay } from "./galleryDate.js";

test("formatGalleryDay: je Sprache landesüblich, mit Wochentag", () => {
  // Reihenfolge und Trennzeichen unterscheiden sich je Locale – deshalb wird
  // hier auf die charakteristischen Bestandteile geprüft statt auf exakte
  // Zeichenketten (die zwischen ICU-Versionen leicht variieren).
  const de = formatGalleryDay("2026-07-18", "de");
  assert.match(de, /^Sa/); // Wochentag zuerst
  assert.match(de, /18/);
  assert.match(de, /2026/);

  const en = formatGalleryDay("2026-07-18", "en");
  assert.match(en, /^Sat/);
  assert.match(en, /Jul/); // Monatsname statt Zahl
  assert.match(en, /2026/);

  const fr = formatGalleryDay("2026-07-18", "fr");
  assert.match(fr, /^sam/);
  assert.match(fr, /juil/);

  const it = formatGalleryDay("2026-07-18", "it");
  assert.match(it, /^sab/);
  assert.match(it, /lug/);
});

test("formatGalleryDay: unterscheidet Tage korrekt (kein Off-by-one durch Zeitzone)", () => {
  assert.match(formatGalleryDay("2026-07-19", "de"), /19/);
  assert.match(formatGalleryDay("2026-07-25", "de"), /25/);
  // 1. Januar ist der klassische Zeitzonen-Stolperstein
  assert.match(formatGalleryDay("2026-01-01", "de"), /01/);
  assert.match(formatGalleryDay("2026-01-01", "de"), /2026/);
});

test("formatGalleryDay: ungültige Eingabe bleibt unverändert", () => {
  assert.equal(formatGalleryDay("kein-datum", "de"), "kein-datum");
  assert.equal(formatGalleryDay("", "de"), "");
});
