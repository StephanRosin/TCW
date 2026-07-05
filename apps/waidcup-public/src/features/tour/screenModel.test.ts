import assert from "node:assert/strict";
import { test } from "node:test";
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
  BOARD_COLUMNS,
  MAX_DAY_ROWS,
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

test("buildOrderOfPlayModel: Tagesliste, EINE Sektion ohne Jetzt/Danach", () => {
  const model = buildOrderOfPlayModel([match("1", "09:00", ["Ann A"], ["Bea B"])], t);
  assert.equal(model.theme, "light");
  assert.equal(model.layout, "table");
  assert.equal(model.sections!.length, 1, "keine Jetzt/Danach-Aufteilung");
  assert.equal(model.sections![0]!.heading, "", "keine Sektionsüberschrift");
  assert.deepEqual(model.sections![0]!.rows[0], ["1", "09:00", "Ann A vs Bea B"]);
});

test("buildOrderOfPlayModel: Doppel wird zweizeilig (ein Paar pro Zeile)", () => {
  const dbl: WaidcupLiveMatch = {
    court: "1",
    eventName: "Herren Doppel",
    side1Names: ["A A", "C C"],
    side2Names: ["B B", "D D"],
    scheduledDate: "2026-07-18",
    scheduledTime: "09:00",
  };
  const model = buildOrderOfPlayModel([dbl], t);
  const matchCell = model.sections![0]!.rows[0]![2]!;
  assert.equal(matchCell, "A A / C C\nvs B B / D D");
  assert.ok(matchCell.includes("\n"), "Doppel-Matchup ist zweizeilig");
});

test("buildOrderOfPlayModel: nach Platz 1-6, dann Uhrzeit sortiert", () => {
  const day = [
    match("2", "11:00", ["B2"], ["b2"]),
    match("1", "10:30", ["A2"], ["a2"]),
    match("1", "09:00", ["A1"], ["a1"]),
  ];
  const model = buildOrderOfPlayModel(day, t);
  assert.deepEqual(
    model.sections![0]!.rows.map((r) => [r[0], r[1]]),
    [
      ["1", "09:00"],
      ["1", "10:30"],
      ["2", "11:00"],
    ],
  );
});

test("buildOrderOfPlayModel: leerer Tag zeigt Hinweis-Note statt Zeilen", () => {
  const model = buildOrderOfPlayModel([], t);
  assert.equal(model.sections![0]!.rows.length, 0);
  assert.equal(model.sections![0]!.note, "orderOfPlay.empty");
});

test("buildOrderOfPlayModel: über MAX_DAY_ROWS gekürzt, Note zeigt Rest", () => {
  const many = Array.from({ length: MAX_DAY_ROWS + 3 }, (_, i) => match("1", `${10 + i}:00`, ["X"], ["Y"]));
  const model = buildOrderOfPlayModel(many, t);
  assert.equal(model.sections![0]!.rows.length, MAX_DAY_ROWS);
  assert.equal(model.sections![0]!.note, "+3");
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
