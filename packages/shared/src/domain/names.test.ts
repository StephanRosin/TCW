import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPlayerName, playerNameKey } from "./names.js";

test("cleanPlayerName entfernt Klassierungs-/Status-Suffixe am Ende", () => {
  assert.equal(cleanPlayerName("Rosin Stephan (R4)"), "Rosin Stephan");
  assert.equal(cleanPlayerName("Weiss Xenia (neu)"), "Weiss Xenia");
  assert.equal(cleanPlayerName("Foo (07)"), "Foo");
  assert.equal(cleanPlayerName("Muster - offen"), "Muster");
  assert.equal(cleanPlayerName("Doppel (R4) (neu)"), "Doppel");
});

test("cleanPlayerName entfernt eine führende Setzposition (Tableau-Seed)", () => {
  assert.equal(cleanPlayerName("(1) Peloso Fabio (R1)"), "Peloso Fabio");
  assert.equal(cleanPlayerName("(12) Muster A."), "Muster A.");
  // Der Seed-Name löst denselben Key wie ohne Seed → Spieler-Link greift.
  assert.equal(playerNameKey("(1) Peloso Fabio (R1)"), playerNameKey("Peloso Fabio (R1)"));
});

test("cleanPlayerName lässt führende Klammern und normale Namen unberührt", () => {
  assert.equal(cleanPlayerName("(R5) Vorne"), "(R5) Vorne");
  assert.equal(cleanPlayerName("O'Driscoll"), "O'Driscoll");
  assert.equal(cleanPlayerName("Hubeková"), "Hubeková");
});

test("cleanPlayerName ist auch bei vielen '(' schnell (kein ReDoS)", () => {
  const evil = "(".repeat(50_000);
  const start = process.hrtime.bigint();
  const out = cleanPlayerName(evil);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(out, evil); // keine schließende Klammer -> nichts zu entfernen
  assert.ok(ms < 100, `zu langsam (${ms.toFixed(1)} ms) – Regex-Backtracking?`);
});

test("playerNameKey ist reihenfolge-unabhängig und klassierungsfrei", () => {
  assert.equal(playerNameKey("Rosin Stephan (R4)"), playerNameKey("Stephan Rosin"));
  assert.equal(playerNameKey("Rosin Stephan (R4)"), "rosin stephan");
});
