import assert from "node:assert/strict";
import { test } from "node:test";
import type { TournamentMatch } from "@tcw/shared";
import { sortTournamentMatches } from "./matchOrder.js";

function match(partial: Partial<TournamentMatch>): TournamentMatch {
  return {
    matchKey: partial.matchKey ?? "k",
    eventId: 1,
    eventName: "MS A",
    mode: "Draw",
    poolName: "",
    roundName: "",
    scheduledDate: "",
    scheduledTime: "",
    court: "",
    side1Names: ["A"],
    side2Names: ["B"],
    result: "",
    status: "open",
    winnerSide: 0,
    ...partial,
  };
}

const PLAYED_OLD = match({ matchKey: "p1", status: "played", scheduledDate: "2026-07-01", result: "6:0 6:0" });
const PLAYED_NEW = match({ matchKey: "p2", status: "played", scheduledDate: "2026-07-03", result: "6:1 6:1" });
const UPCOMING_SOON = match({ matchKey: "u1", scheduledDate: "2026-07-05", scheduledTime: "10:00" });
const UPCOMING_LATER = match({ matchKey: "u2", scheduledDate: "2026-07-05", scheduledTime: "14:00" });
const NO_DATE = match({ matchKey: "n1" });

const ALL = [UPCOMING_LATER, NO_DATE, PLAYED_OLD, UPCOMING_SOON, PLAYED_NEW];

test("playedFirst (Default): gespielte neueste zuerst, dann anstehende, ohne Datum zuletzt", () => {
  const sorted = sortTournamentMatches(ALL, "playedFirst");
  assert.deepEqual(
    sorted.map((m) => m.matchKey),
    ["p2", "p1", "u1", "u2", "n1"],
  );
});

test("upcomingFirst: anstehende nächste zuerst, dann gespielte neueste zuerst, ohne Datum zuletzt", () => {
  const sorted = sortTournamentMatches(ALL, "upcomingFirst");
  assert.deepEqual(
    sorted.map((m) => m.matchKey),
    ["u1", "u2", "p2", "p1", "n1"],
  );
});

test("Walkover ohne Datum steht bei seiner Runde, nicht am Anfang der Liste", () => {
  // Echter Fall aus dem Waidcup: ein WO im 1/16-Final wurde nie angesetzt und
  // hat deshalb kein Datum. Ohne Ersatztermin sortierte es sich wegen des
  // Zeitstempels "T00:00" (grösser als jedes "2026-...") an die Spitze.
  const r16a = match({ matchKey: "r16a", status: "played", roundName: "1/16 Final", scheduledDate: "2026-07-20", scheduledTime: "18:00", result: "6:0 6:0" });
  const r16wo = match({ matchKey: "r16wo", status: "played", roundName: "1/16 Final", result: "WO" });
  const finale = match({ matchKey: "fin", status: "played", roundName: "Final", scheduledDate: "2026-07-26", scheduledTime: "14:00", result: "6:2 6:1" });

  const sorted = sortTournamentMatches([r16wo, finale, r16a], "playedFirst");
  // Final (neuester Termin) oben, danach die beiden 1/16-Final-Partien.
  assert.deepEqual(sorted.map((m) => m.matchKey), ["fin", "r16a", "r16wo"]);
  assert.notEqual(sorted[0]!.matchKey, "r16wo");
});

test("Ohne Runden-Geschwister erbt eine undatierte Partie den Termin ihrer Konkurrenz", () => {
  const anderesEvent = match({ matchKey: "e2", eventId: 2, status: "played", scheduledDate: "2026-07-26", result: "6:0 6:0" });
  const frueh = match({ matchKey: "e1a", status: "played", roundName: "Achtelfinal", scheduledDate: "2026-07-18", result: "6:0 6:0" });
  const wo = match({ matchKey: "e1wo", status: "played", roundName: "Viertelfinal", result: "WO" });

  const sorted = sortTournamentMatches([wo, anderesEvent, frueh], "playedFirst");
  // Konkurrenz 1 hat keinen Viertelfinal-Termin -> WO erbt 18.07. und bleibt
  // damit hinter dem Match vom 26.07., nicht davor.
  assert.deepEqual(sorted.map((m) => m.matchKey), ["e2", "e1a", "e1wo"]);
});

test("Partie ganz ohne Termin-Bezug bleibt am Ende ihrer Gruppe", () => {
  const gespielt = match({ matchKey: "p", status: "played", scheduledDate: "2026-07-20", result: "6:0 6:0" });
  const ohneAlles = match({ matchKey: "x", eventId: 99, status: "played", result: "WO" });
  const sorted = sortTournamentMatches([ohneAlles, gespielt], "playedFirst");
  assert.deepEqual(sorted.map((m) => m.matchKey), ["p", "x"]);
});
