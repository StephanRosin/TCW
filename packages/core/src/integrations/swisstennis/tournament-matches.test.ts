import assert from "node:assert/strict";
import { test } from "node:test";
import { mapEventMatches, winnerSideFromScore } from "./tournament-matches.js";

test("winnerSideFromScore zählt Sätze – auch für Doppel und mit '/'-Trenner", () => {
  assert.equal(winnerSideFromScore("6:1 6:1"), 1);
  assert.equal(winnerSideFromScore("1/6 2/6"), 2);
  // Match-Tiebreak im dritten Satz: Seite 1 gewinnt 2:1 Sätze.
  assert.equal(winnerSideFromScore("5/7 6/2 10/3"), 1);
});

test("winnerSideFromScore liefert 0 bei Gleichstand oder ohne Resultat", () => {
  assert.equal(winnerSideFromScore("6:1 1:6"), 0);
  assert.equal(winnerSideFromScore(""), 0);
  assert.equal(winnerSideFromScore("w.o."), 0);
});

test("mapEventMatches (Draw) verknüpft Gegner, normalisiert '/' und erkennt den Sieger", () => {
  const payload = {
    Iotto: {
      drawtable: {
        drawbody: {
          draw: [
            {
              alevel: 0,
              rposition: 0,
              name: { content: "Anna Muster" },
              court: "01/02/26 14:00 (Platz 1)",
              result: { content: "6/1 6/2" },
            },
            { alevel: 1, rposition: 0, name: { content: "Anna Muster" } },
            { alevel: 1, rposition: 1, name: { content: "Bea Beispiel" } },
          ],
        },
      },
    },
  };

  const records = mapEventMatches(payload, "Draw", "Damen R6", 42, false);
  assert.equal(records.length, 1);
  const match = records[0]!;
  assert.equal(match.mode, "Draw");
  assert.equal(match.roundName, "Final");
  assert.equal(match.player1Name, "Anna Muster");
  assert.equal(match.player2Name, "Bea Beispiel");
  assert.equal(match.result, "6:1 6:2");
  assert.equal(match.winnerSide, 1);
  assert.equal(match.status, "played");
  assert.equal(match.scheduledDate, "2026-02-01");
  assert.equal(match.scheduledTime, "14:00");
  assert.equal(match.court, "Platz 1");
});

test("mapEventMatches (Round-robin) liest Resultat aus dem Kommentar und leitet den Sieger ab", () => {
  const payload = {
    Iotto: {
      IoEvent: {
        ioPoolSet: {
          IoPool: {
            polName: "Gruppe A",
            ioPlayerPoolSet: {
              IoPlayerPool: {
                ioPlayer: {
                  IoPlayer: {
                    plyFirstName: "Anna",
                    plyName: "Muster",
                    ioRRMatchRrmIdPlayer1Set: {
                      IoRRMatch: {
                        rRMatchId: 7,
                        rrmComment: "6/1 6/3",
                        rrmDate: { year: 2026, month: 1, day: 15, hour: 9, minute: 30 },
                        ioPlayerRrmIdPlayer2: {
                          IoPlayer: { plyFirstName: "Bea", plyName: "Beispiel" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const records = mapEventMatches(payload, "Round-robin", "Herren Aktiv", 99, false);
  assert.equal(records.length, 1);
  const match = records[0]!;
  assert.equal(match.mode, "Round-robin");
  assert.equal(match.poolName, "Gruppe A");
  assert.equal(match.player1Name, "Anna Muster");
  assert.equal(match.player2Name, "Bea Beispiel");
  assert.equal(match.result, "6:1 6:3");
  assert.equal(match.winnerSide, 1);
  // Monat ist 0-basiert in den Rohdaten → Januar+1 = "02"? Nein: month:1 → Februar.
  assert.equal(match.scheduledDate, "2026-02-15");
  assert.equal(match.scheduledTime, "09:30");
});

test("mapEventMatches überspringt Partien mit offenem/bye-Gegner", () => {
  const payload = {
    Iotto: {
      drawtable: {
        drawbody: {
          draw: [
            {
              alevel: 0,
              rposition: 0,
              name: { content: "Anna Muster" },
              result: { content: "6/0 6/0" },
            },
            { alevel: 1, rposition: 0, name: { content: "Anna Muster" } },
            { alevel: 1, rposition: 1, name: { content: "bye" } },
          ],
        },
      },
    },
  };
  assert.deepEqual(mapEventMatches(payload, "Draw", "Damen R6", 42, false), []);
});
