import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapDrawBracket,
  mapEventMatches,
  mapPoolStandings,
  winnerSideFromScore,
} from "./tournament-matches.js";

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

test("mapDrawBracket baut den Baum bis zum Final, auch ohne ausgeloste Folgerunden", () => {
  const payload = {
    Iotto: {
      drawtable: {
        drawbody: {
          draw: [
            { alevel: 2, rposition: 0, name: { content: "(1) (R4) Anna Muster" } },
            { alevel: 2, rposition: 1, name: { content: "(R6) Bea Beispiel" } },
            { alevel: 2, rposition: 2, name: { content: "(R7) Cara Test" } },
            { alevel: 2, rposition: 3, name: { content: "(R8) Dora Demo" } },
            { alevel: 1, rposition: 0, name: { content: "Muster A." }, result: { content: "6/1 6/2" } },
            { alevel: 1, rposition: 1, name: { content: "" } },
            { alevel: 0, rposition: 0, name: { content: "" } },
          ],
        },
      },
    },
  };

  const bracket = mapDrawBracket(payload)!;
  assert.deepEqual(
    bracket.rounds.map((round) => `${round.roundName}:${round.matches.length}`),
    ["Halbfinal:2", "Final:1"],
  );
  assert.deepEqual(bracket.championNames, []);

  const semi = bracket.rounds[0]!;
  assert.deepEqual(semi.matches[0], {
    side1Names: ["Anna Muster (R4)"],
    side2Names: ["Bea Beispiel (R6)"],
    result: "6:1 6:2",
    winnerSide: 1,
  });
  // Noch nicht gespielte Partie bleibt erhalten (offen).
  assert.equal(semi.matches[1]!.result, "");
  assert.equal(semi.matches[1]!.winnerSide, 0);
  // Final: eine Seite steht (Halbfinal-Sieger), die andere ist noch offen.
  assert.deepEqual(bracket.rounds[1]!.matches[0]!.side2Names, []);
});

test("mapPoolStandings liefert die Pool-Tabelle nach Rang sortiert", () => {
  const payload = {
    Iotto: {
      IoEvent: {
        ioPoolSet: {
          IoPool: {
            polName: "Gruppe A",
            ioPlayerPoolSet: {
              IoPlayerPool: [
                {
                  plpRank: 2,
                  plpNbMatches: 2,
                  plpNbVictories: 1,
                  plpNbWonsets: 3,
                  plpNbLostSets: 2,
                  plpNbWonGames: 20,
                  plpNbLostGames: 18,
                  ioPlayer: { IoPlayer: { plyFirstName: "Anna", plyName: "Muster", plyRankingComment: "R4" } },
                },
                {
                  plpRank: 1,
                  plpNbMatches: 2,
                  plpNbVictories: 2,
                  plpNbWonsets: 4,
                  plpNbLostSets: 1,
                  plpNbWonGames: 24,
                  plpNbLostGames: 12,
                  ioPlayer: { IoPlayer: { plyFirstName: "Bea", plyName: "Beispiel" } },
                },
              ],
            },
          },
        },
      },
    },
  };

  const pools = mapPoolStandings(payload, false);
  assert.equal(pools.length, 1);
  assert.equal(pools[0]!.poolName, "Gruppe A");
  assert.deepEqual(
    pools[0]!.rows.map((row) => `${row.rank}.${row.names.join("/")} ${row.victories}S ${row.sets}`),
    ["1.Bea Beispiel 2S 4:1", "2.Anna Muster (R4) 1S 3:2"],
  );
});

test("mapDrawBracket: Doppel-Klassierungen für beide und volle Namen in Folgerunden", () => {
  const payload = {
    Iotto: {
      drawtable: {
        drawbody: {
          draw: [
            // Einstiegsrunde (volle Namen, Doppel mit kombinierter Klassierung)
            { alevel: 1, rposition: 0, name: { content: "(R4/R3) Rosin Stephan", name2: " / Farsky Simon" } },
            { alevel: 1, rposition: 1, name: { content: "(R6/R7) Beck Claudia", name2: " / Sirbu Laura" } },
            // Folgerunde: gespeichert als Kurzform, soll aber voll angezeigt werden
            { alevel: 0, rposition: 0, name: { content: "Rosin S." }, result: { content: "6/3 6/4" } },
          ],
        },
      },
    },
  };
  const bracket = mapDrawBracket(payload)!;
  const final = bracket.rounds[0]!.matches[0]!;
  // Beide Doppelspieler mit eigener Klassierung
  assert.deepEqual(final.side1Names, ["Rosin Stephan (R4)", "Farsky Simon (R3)"]);
  assert.deepEqual(final.side2Names, ["Beck Claudia (R6)", "Sirbu Laura (R7)"]);
  assert.equal(final.winnerSide, 1);
  // Sieger wird mit vollem Namen propagiert (nicht "Rosin S.")
  assert.deepEqual(bracket.championNames, ["Rosin Stephan (R4)", "Farsky Simon (R3)"]);
});
