import assert from "node:assert/strict";
import { test } from "node:test";
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
  BOARD_COLUMNS,
} from "./screenModel.js";

// Übersetzungs-Stub: gibt den Key zurück, damit Tests keys statt Texte prüfen.
const t = (key: string): string => key;

function match(court: string, time: string, s1: string[], s2: string[]): WaidcupLiveMatch {
  return { court, eventName: "Herren R1/R5", side1Names: s1, side2Names: s2, scheduledDate: "2026-07-18", scheduledTime: time };
}

function live(now: WaidcupLiveMatch[], upcoming: WaidcupLiveMatch[]): WaidcupLiveResponse {
  return { now, upcoming };
}

test("buildLocationModel: Text-Layout, Light, mit Adresszeilen und ÖV/Parken", () => {
  const model = buildLocationModel(t);
  assert.equal(model.layout, "text");
  assert.equal(model.theme, "light");
  const texts = model.textLines!.map((l) => l.text);
  assert.ok(texts.includes("Waidbadstrasse 151"), "Adresse enthalten");
  assert.ok(texts.some((x) => x === "location.transitText"), "ÖV-Text enthalten");
});

test("buildInfosModel: Text-Layout, Light, mit Turnierdauer", () => {
  const model = buildInfosModel(t);
  assert.equal(model.layout, "text");
  assert.equal(model.theme, "light");
  assert.ok(model.textLines!.some((l) => l.text === "infos.dateDurationValue"));
});

test("buildOrderOfPlayModel: Raster-Layout (grid), Light, mit Datums-Untertitel", () => {
  const model = buildOrderOfPlayModel([match("1", "09:00", ["Ann A"], ["Bea B"])], t, "de");
  assert.equal(model.theme, "light");
  assert.equal(model.layout, "grid");
  assert.ok(model.grid, "grid vorhanden");
  // 18. Juli 2026 ist ein Samstag.
  assert.match(model.grid!.subtitle, /Samstag.*18.*Juli.*2026/);
});

test("buildOrderOfPlayModel: mindestens Courts 1-6 als Spalten", () => {
  const model = buildOrderOfPlayModel([match("1", "09:00", ["A"], ["B"])], t, "de");
  assert.deepEqual(model.grid!.courts, [1, 2, 3, 4, 5, 6]);
});

test("buildOrderOfPlayModel: höhere Platznummer erweitert die Spalten", () => {
  const model = buildOrderOfPlayModel([match("8", "09:00", ["A"], ["B"])], t, "de");
  assert.deepEqual(model.grid!.courts, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("buildOrderOfPlayModel: Match landet in Court-Spalte und Zeit-Block", () => {
  const model = buildOrderOfPlayModel([match("2", "10:30", ["Weiss Xenia (R5)"], ["Roth Lea (R6)"])], t, "de");
  const block = model.grid!.blocks.find((b) => b.time === "10:30")!;
  // Court 2 = Index 1; Spieler mit vorangestelltem Ranking, "vs" dazwischen.
  assert.deepEqual(block.cells[1], ["(R5) Weiss Xenia", "vs", "(R6) Roth Lea"]);
  assert.equal(block.cells[0], null, "Court 1 in diesem Block leer");
});

test("buildOrderOfPlayModel: Doppel listet alle vier Spieler zeilenweise", () => {
  const dbl = match("1", "09:00", ["A A (R4)", "C C (R5)"], ["B B (R4)", "D D (R6)"]);
  const model = buildOrderOfPlayModel([dbl], t, "de");
  const cell = model.grid!.blocks[0]!.cells[0]!;
  assert.deepEqual(cell, ["(R4) A A", "(R5) C C", "vs", "(R4) B B", "(R6) D D"]);
});

test("buildOrderOfPlayModel: Zeit-Blöcke aufsteigend sortiert", () => {
  const model = buildOrderOfPlayModel(
    [match("1", "11:00", ["A"], ["a"]), match("1", "09:00", ["B"], ["b"]), match("2", "10:00", ["C"], ["c"])],
    t,
    "de",
  );
  assert.deepEqual(
    model.grid!.blocks.map((b) => b.time),
    ["09:00", "10:00", "11:00"],
  );
});

test("buildOrderOfPlayModel: leerer Tag zeigt Hinweis, keine Blöcke", () => {
  const model = buildOrderOfPlayModel([], t, "de");
  assert.equal(model.grid!.blocks.length, 0);
  assert.equal(model.grid!.empty, "orderOfPlay.empty");
});

test("buildLiveModel: Light, breite Spalten ohne Kategorie (3 Spalten)", () => {
  const model = buildLiveModel(live([match("2", "11:00", ["Now1"], ["Now2"])], [match("3", "12:00", ["Up1"], ["Up2"])]), t);
  assert.equal(model.theme, "light");
  assert.equal(model.sections!.length, 2);
  assert.equal(model.sections![0]!.columns.length, BOARD_COLUMNS.length);
  assert.equal(model.sections![0]!.columns.length, 3, "keine Kategorie-Spalte");
  assert.equal(model.sections![0]!.rows[0]![2], "Now1 vs Now2");
  assert.equal(model.sections![1]!.rows[0]![2], "Up1 vs Up2");
});
