import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanPlayerName,
  compareByRanking,
  comparePlayers,
  compareTeamsWithinGender,
  isRankingToken,
  rankingOrder,
  rankingTrend,
} from "@tcw/shared";

test("rankingOrder ordnet National vor Regional vor unbekannt", () => {
  assert.deepEqual(rankingOrder("N4"), [0, 4]);
  assert.deepEqual(rankingOrder("R6"), [1, 6]);
  assert.deepEqual(rankingOrder(""), [9, 999]);
  assert.deepEqual(rankingOrder("Aktive"), [8, 999]);
});

test("compareByRanking sortiert beste Klassierung zuerst", () => {
  const sorted = ["R4", "N2", "R1", "N4"].sort(compareByRanking);
  assert.deepEqual(sorted, ["N2", "N4", "R1", "R4"]);
});

test("rankingTrend erkennt Verbesserung und Verschlechterung", () => {
  assert.equal(rankingTrend("R5", "R4"), "up");
  assert.equal(rankingTrend("R4", "R5"), "down");
  assert.equal(rankingTrend("R4", "R4"), "flat");
  assert.equal(rankingTrend("R1", "N4"), "up");
});

test("isRankingToken akzeptiert nur echte Klassierungen, keine Gesetztennummern", () => {
  assert.equal(isRankingToken("R4"), true);
  assert.equal(isRankingToken("N1"), true);
  assert.equal(isRankingToken("(1)"), false);
  assert.equal(isRankingToken("1"), false);
});

test("comparePlayers ordnet Captain, Stellvertretung, dann Klassierung", () => {
  const players = [
    { captainStatus: 0 as const, klassierung: "R3", name: "Zoe" },
    { captainStatus: 2 as const, klassierung: "R6", name: "Vize" },
    { captainStatus: 1 as const, klassierung: "R9", name: "Captain" },
    { captainStatus: 0 as const, klassierung: "R1", name: "Anna" },
  ];
  const sorted = [...players].sort(comparePlayers).map((player) => player.name);
  assert.deepEqual(sorted, ["Captain", "Vize", "Anna", "Zoe"]);
});

test("compareTeamsWithinGender sortiert Liga vor Kategorie", () => {
  const teams = [
    { gender: "Herren", category: "35+", liga: "1. Liga" },
    { gender: "Herren", category: "Aktiv", liga: "NLC" },
    { gender: "Herren", category: "Aktiv", liga: "1. Liga" },
  ];
  const sorted = [...teams]
    .sort(compareTeamsWithinGender)
    .map((team) => `${team.category} ${team.liga}`);
  assert.deepEqual(sorted, ["Aktiv NLC", "Aktiv 1. Liga", "35+ 1. Liga"]);
});

test("cleanPlayerName entfernt Statuszusätze, behält Sonderzeichen", () => {
  assert.equal(cleanPlayerName("Maria Schnuck (neu)"), "Maria Schnuck");
  assert.equal(cleanPlayerName("Weinmann Elio (10) - bestätigt"), "Weinmann Elio");
  assert.equal(cleanPlayerName("Hanna O'Driscoll (92)"), "Hanna O'Driscoll");
  assert.equal(cleanPlayerName("Martina Wüst"), "Martina Wüst");
});
