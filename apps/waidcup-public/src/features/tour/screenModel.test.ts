import assert from "node:assert/strict";
import { test } from "node:test";
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
  LIVE_COLUMNS,
  MAX_SECTION_ROWS,
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

test("buildOrderOfPlayModel: Light, zwei Sektionen Jetzt/Danach", () => {
  const model = buildOrderOfPlayModel(live([match("1", "09:00", ["Ann A"], ["Bea B"])], []), t);
  assert.equal(model.theme, "light");
  assert.equal(model.layout, "table");
  assert.equal(model.sections!.length, 2);
  assert.equal(model.sections![0]!.heading, "board.now");
  assert.equal(model.sections![1]!.heading, "board.next");
  // Match-Zelle "a/b vs c/d"; Order of Play hat die Kategorie-Spalte (4 Zellen).
  assert.deepEqual(model.sections![0]!.rows[0], ["1", "09:00", "Ann A vs Bea B", "Herren R1/R5"]);
});

test("buildOrderOfPlayModel: jede Sektion nach Platz 1-6 sortiert", () => {
  const now = [match("3", "09:00", ["C"], ["c"]), match("1", "09:00", ["A"], ["a"]), match("2", "09:00", ["B"], ["b"])];
  const model = buildOrderOfPlayModel(live(now, []), t);
  assert.deepEqual(model.sections![0]!.rows.map((r) => r[0]), ["1", "2", "3"]);
});

test("buildOrderOfPlayModel: leere Sektion zeigt Hinweis-Note statt Zeilen", () => {
  const model = buildOrderOfPlayModel(live([], []), t);
  assert.equal(model.sections![0]!.rows.length, 0);
  assert.equal(model.sections![0]!.note, "live.empty");
});

test("buildOrderOfPlayModel: Sektion über MAX_SECTION_ROWS gekürzt, Note zeigt Rest", () => {
  const many = Array.from({ length: MAX_SECTION_ROWS + 2 }, (_, i) => match(String(i + 1), "10:00", ["X"], ["Y"]));
  const model = buildOrderOfPlayModel(live(many, []), t);
  assert.equal(model.sections![0]!.rows.length, MAX_SECTION_ROWS);
  assert.equal(model.sections![0]!.note, "+2");
});

test("buildLiveModel: Light, breite Spalten ohne Kategorie (3 Spalten)", () => {
  const model = buildLiveModel(live([match("2", "11:00", ["Now1"], ["Now2"])], [match("3", "12:00", ["Up1"], ["Up2"])]), t);
  assert.equal(model.theme, "light");
  assert.equal(model.sections!.length, 2);
  assert.equal(model.sections![0]!.columns.length, LIVE_COLUMNS.length);
  assert.equal(model.sections![0]!.columns.length, 3, "keine Kategorie-Spalte");
  assert.equal(model.sections![0]!.rows[0]![2], "Now1 vs Now2");
  assert.equal(model.sections![1]!.rows[0]![2], "Up1 vs Up2");
});
