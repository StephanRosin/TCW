import assert from "node:assert/strict";
import { test } from "node:test";
import type { TournamentMatch } from "@tcw/shared";
import { compareTournamentMatches } from "./matchOrder.js";

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
  const sorted = [...ALL].sort(compareTournamentMatches("playedFirst"));
  assert.deepEqual(
    sorted.map((m) => m.matchKey),
    ["p2", "p1", "u1", "u2", "n1"],
  );
});

test("upcomingFirst: anstehende nächste zuerst, dann gespielte neueste zuerst, ohne Datum zuletzt", () => {
  const sorted = [...ALL].sort(compareTournamentMatches("upcomingFirst"));
  assert.deepEqual(
    sorted.map((m) => m.matchKey),
    ["u1", "u2", "p2", "p1", "n1"],
  );
});
