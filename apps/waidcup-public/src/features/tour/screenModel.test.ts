import assert from "node:assert/strict";
import { test } from "node:test";
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
  MAX_TABLE_ROWS,
} from "./screenModel.js";

// Übersetzungs-Stub: gibt den Key zurück, damit Tests keys statt Texte prüfen.
const t = (key: string): string => key;

function match(court: string, time: string, s1: string[], s2: string[], date = "2026-07-18"): WaidcupLiveMatch {
  return { court, eventName: "Herren R1/R5", side1Names: s1, side2Names: s2, scheduledDate: date, scheduledTime: time };
}

test("buildLocationModel: Text-Layout mit Adresszeilen und ÖV/Parken", () => {
  const model = buildLocationModel(t);
  assert.equal(model.layout, "text");
  assert.equal(model.theme, "dark");
  const texts = model.textLines!.map((l) => l.text);
  assert.ok(texts.includes("Waidbadstrasse 151"), "Adresse enthalten");
  assert.ok(texts.some((x) => x === "location.transitText"), "ÖV-Text enthalten");
});

test("buildOrderOfPlayModel: Tabelle, eine Zeile pro Match, Match-Zelle 'a/b vs c/d'", () => {
  const model = buildOrderOfPlayModel([match("1", "09:00", ["Ann A"], ["Bea B"])], t);
  assert.equal(model.layout, "table");
  assert.equal(model.rows!.length, 1);
  assert.deepEqual(model.rows![0], ["1", "09:00", "Ann A vs Bea B", "Herren R1/R5"]);
});

test("buildOrderOfPlayModel: leer -> Hinweiszeile als Note, keine Rows", () => {
  const model = buildOrderOfPlayModel([], t);
  assert.equal(model.rows!.length, 0);
  assert.equal(model.note, "orderOfPlay.empty");
});

test("buildOrderOfPlayModel: über MAX_TABLE_ROWS gekürzt, Note zeigt Rest", () => {
  const many = Array.from({ length: MAX_TABLE_ROWS + 3 }, (_, i) => match(String(i), "10:00", ["X"], ["Y"]));
  const model = buildOrderOfPlayModel(many, t);
  assert.equal(model.rows!.length, MAX_TABLE_ROWS);
  assert.equal(model.note, "+3");
});

test("buildLiveModel: Light-Theme, 'now' zuerst, dann 'upcoming'", () => {
  const live: WaidcupLiveResponse = {
    now: [match("2", "11:00", ["Now1"], ["Now2"])],
    upcoming: [match("3", "12:00", ["Up1"], ["Up2"])],
  };
  const model = buildLiveModel(live, t);
  assert.equal(model.theme, "light");
  assert.equal(model.layout, "table");
  assert.equal(model.rows![0]![2], "Now1 vs Now2");
  assert.equal(model.rows![1]![2], "Up1 vs Up2");
});

test("buildInfosModel: Text-Layout mit Turnierdauer", () => {
  const model = buildInfosModel(t);
  assert.equal(model.layout, "text");
  assert.ok(model.textLines!.some((l) => l.text === "infos.dateDurationValue"));
});
