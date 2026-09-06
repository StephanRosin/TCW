import assert from "node:assert/strict";
import { test } from "node:test";
import {
  drawSlotsFromGrid,
  mapDrawBracket,
  mapEventMatches,
  mapPoolStandings,
  roundName,
  roundRobinMatchId,
  winnerSideFromScore,
} from "./tournament-matches.js";
import { scheduleKey, type ScheduleIndex } from "./tournament-schedule.js";

/**
 * Baut eine Antwort im Rasterformat der Turnier-API.
 *
 * Die Tests beschreiben die Slots weiterhin als `level`/`position` – so, wie das
 * Modul intern rechnet und wie die match_key aufgebaut sind. Der Helfer rechnet
 * das in Spalte/Zeile um: Spalte 1 ist die Einstiegsrunde, die letzte Spalte
 * der Sieger, also `column = maxLevel + 1 - level`.
 */
function drawPayload(
  maxLevel: number,
  slots: { level: number; position: number; name1?: string; name2?: string; num?: number; score?: string }[],
) {
  const columns = maxLevel + 1;
  return {
    grid: { columns, rows: 0 },
    results: slots.map((slot) => ({
      position: { column: columns - slot.level, row: slot.position },
      name1: slot.name1 ?? "",
      name2: slot.name2,
      player1Number: slot.num,
      score: slot.score,
    })),
  };
}

function scheduleWith(entries: { side1: string[]; side2: string[]; date: string; time: string; court: string }[]): ScheduleIndex {
  const index: ScheduleIndex = new Map();
  for (const entry of entries) {
    index.set(scheduleKey(entry.side1, entry.side2), { date: entry.date, time: entry.time, court: entry.court });
  }
  return index;
}

test("roundName: benannte Runden 0–3, ab Level 4 die 1/N-Final-Schreibweise", () => {
  assert.equal(roundName(0), "Final");
  assert.equal(roundName(1), "Halbfinal");
  assert.equal(roundName(2), "Viertelfinal");
  assert.equal(roundName(3), "Achtelfinal");
  assert.equal(roundName(4), "1/16 Final");
  assert.equal(roundName(5), "1/32 Final");
  assert.equal(roundName(6), "1/64 Final");
  assert.equal(roundName(7), "1/128 Final");
});

test("winnerSideFromScore zählt Sätze – auch für Doppel und mit '/'-Trenner", () => {
  assert.equal(winnerSideFromScore("6:1 6:1"), 1);
  assert.equal(winnerSideFromScore("1/6 2/6"), 2);
  assert.equal(winnerSideFromScore("5/7 6/2 10/3"), 1);
});

test("winnerSideFromScore liefert 0 bei Gleichstand oder ohne Resultat", () => {
  assert.equal(winnerSideFromScore("6:1 1:6"), 0);
  assert.equal(winnerSideFromScore(""), 0);
  assert.equal(winnerSideFromScore("w.o."), 0);
});

test("drawSlotsFromGrid: Spalte wird zu alevel, Zeilenreihenfolge zu rposition", () => {
  const slots = drawSlotsFromGrid(
    drawPayload(1, [
      { level: 1, position: 0, name1: "Anna Muster" },
      { level: 1, position: 1, name1: "Bea Beispiel" },
      { level: 0, position: 0, name1: "Muster A.", score: "6/1 6/2" },
    ]),
  );
  assert.deepEqual(
    slots.map((slot) => `${slot.alevel}:${slot.rposition}`).sort(),
    ["0:0", "1:0", "1:1"],
  );
});

test("drawSlotsFromGrid holt über die Spielernummer den vollen Namen aus Spalte 1", () => {
  const slots = drawSlotsFromGrid(
    drawPayload(1, [
      { level: 1, position: 0, name1: "(R4) Anna Muster", num: 4711 },
      { level: 1, position: 1, name1: "(R6) Bea Beispiel", num: 4712 },
      // Die Folgerunde kürzt ab, trägt aber dieselbe Spielernummer.
      { level: 0, position: 0, name1: "Muster A.", num: 4711, score: "6/1 6/2" },
    ]),
  );
  const final = slots.find((slot) => slot.alevel === 0)!;
  assert.equal(final.name?.content, "(R4) Anna Muster");
});

test("mapEventMatches (Draw) verknüpft Gegner, normalisiert '/' und erkennt den Sieger", () => {
  const payload = drawPayload(1, [
    { level: 1, position: 0, name1: "Anna Muster" },
    { level: 1, position: 1, name1: "Bea Beispiel" },
    { level: 0, position: 0, name1: "Anna Muster", score: "6/1 6/2" },
  ]);
  const schedule = scheduleWith([
    { side1: ["Anna Muster"], side2: ["Bea Beispiel"], date: "2026-02-01", time: "14:00", court: "Platz 1" },
  ]);

  const records = mapEventMatches(payload, "Draw", "Damen R6", 42, false, schedule);
  assert.equal(records.length, 1);
  const match = records[0]!;
  assert.equal(match.mode, "Draw");
  assert.equal(match.roundName, "Final");
  assert.equal(match.player1Name, "Anna Muster");
  assert.equal(match.player2Name, "Bea Beispiel");
  assert.equal(match.result, "6:1 6:2");
  assert.equal(match.winnerSide, 1);
  assert.equal(match.status, "played");
  // Termin kommt aus dem Spielplan – im Tableau steht er nicht mehr.
  assert.equal(match.scheduledDate, "2026-02-01");
  assert.equal(match.scheduledTime, "14:00");
  assert.equal(match.court, "Platz 1");
});

test("mapEventMatches (Draw) nimmt terminierte Partien ohne Resultat auf", () => {
  const payload = drawPayload(1, [
    { level: 1, position: 0, name1: "Anna Muster" },
    { level: 1, position: 1, name1: "Bea Beispiel" },
    { level: 0, position: 0, name1: "" },
  ]);
  const ohneTermin = mapEventMatches(payload, "Draw", "Damen R6", 42, false);
  assert.deepEqual(ohneTermin, []);

  const schedule = scheduleWith([
    { side1: ["Anna Muster"], side2: ["Bea Beispiel"], date: "2026-07-18", time: "09:00", court: "Platz 2" },
  ]);
  const mitTermin = mapEventMatches(payload, "Draw", "Damen R6", 42, false, schedule);
  assert.equal(mitTermin.length, 1);
  assert.equal(mitTermin[0]!.status, "open");
  assert.equal(mitTermin[0]!.scheduledDate, "2026-07-18");
});

test("mapEventMatches überspringt Partien mit offenem/bye-Gegner", () => {
  const payload = drawPayload(1, [
    { level: 1, position: 0, name1: "Anna Muster" },
    { level: 1, position: 1, name1: "bye" },
    { level: 0, position: 0, name1: "Anna Muster", score: "6/0 6/0" },
  ]);
  assert.deepEqual(mapEventMatches(payload, "Draw", "Damen R6", 42, false), []);
});

test("mapEventMatches (Round-robin) liest Gruppenpartien mit Resultat und Sieger", () => {
  const payload = {
    groupCategories: [
      {
        name: "Gruppe A",
        games: [
          {
            teams: [{ players: ["Muster Anna"] }, { players: ["Beispiel Bea"] }],
            score: "6:1 6:3",
            wo: false,
            courtName: "Platz 3",
          },
        ],
      },
    ],
  };
  const schedule = scheduleWith([
    { side1: ["Muster Anna"], side2: ["Beispiel Bea"], date: "2026-02-15", time: "09:30", court: "Platz 3" },
  ]);

  const records = mapEventMatches(payload, "Round-robin", "Herren Aktiv", 99, false, schedule);
  assert.equal(records.length, 1);
  const match = records[0]!;
  assert.equal(match.mode, "Round-robin");
  assert.equal(match.poolName, "Gruppe A");
  assert.equal(match.player1Name, "Muster Anna");
  assert.equal(match.player2Name, "Beispiel Bea");
  assert.equal(match.result, "6:1 6:3");
  assert.equal(match.winnerSide, 1);
  assert.equal(match.scheduledDate, "2026-02-15");
  assert.equal(match.scheduledTime, "09:30");
});

test("mapEventMatches (Round-robin): Walkover ohne Angabe der Siegerseite", () => {
  // Die Schnittstelle meldet `wo: true` und ein leeres Resultat, aber nicht
  // mehr, welche Seite gewonnen hat.
  const payload = {
    groupCategories: [
      {
        name: "Capriati",
        games: [
          {
            teams: [{ players: ["Jüngling Isabel"] }, { players: ["zu Sayn-Wittgenstein Jasmin"] }],
            score: "",
            wo: true,
          },
        ],
      },
    ],
  };
  const match = mapEventMatches(payload, "Round-robin", "WS 40+", 1, false)[0]!;
  assert.equal(match.result, "w.o.");
  assert.equal(match.status, "played");
  assert.equal(match.player2Name, "zu Sayn-Wittgenstein Jasmin");
  assert.equal(match.winnerSide, 0);
});

test("roundRobinMatchId ist unabhängig von Seiten-, Namensreihenfolge und Klassierung", () => {
  const erste = roundRobinMatchId(829549, ["Rosin Stephan", "Haubensak Simone"], ["Undiks Tomass", "Buck Nina"]);
  const zweite = roundRobinMatchId(
    829549,
    ["Tomass Undiks (R3)", "Nina Buck (R7)"],
    ["Stephan Rosin (R4)", "Simone Haubensak (R2)"],
  );
  assert.equal(erste, zweite);
  // Dieselbe Paarung in einer anderen Konkurrenz ist eine andere Partie.
  assert.notEqual(erste, roundRobinMatchId(829480, ["Rosin Stephan"], ["Undiks Tomass"]));
  // Der Wert selbst ist festgeschrieben: die Clubmeisterschaft und die
  // Waidcup-Aufgaben berechnen ihn identisch.
  assert.equal(erste, "rr_b9ebd93abf65");
});

test("mapDrawBracket baut den Baum bis zum Final, auch ohne ausgeloste Folgerunden", () => {
  const payload = drawPayload(2, [
    { level: 2, position: 0, name1: "(1) (R4) Anna Muster" },
    { level: 2, position: 1, name1: "(R6) Bea Beispiel" },
    { level: 2, position: 2, name1: "(R7) Cara Test" },
    { level: 2, position: 3, name1: "(R8) Dora Demo" },
    { level: 1, position: 0, name1: "Muster A.", score: "6/1 6/2" },
    { level: 1, position: 1, name1: "" },
    { level: 0, position: 0, name1: "" },
  ]);

  const bracket = mapDrawBracket(payload)!;
  assert.deepEqual(
    bracket.rounds.map((round) => `${round.roundName}:${round.matches.length}`),
    ["Halbfinal:2", "Final:1"],
  );
  assert.deepEqual(bracket.championNames, []);

  const semi = bracket.rounds[0]!;
  assert.deepEqual(semi.matches[0], {
    side1Names: ["(1) Anna Muster (R4)"],
    side2Names: ["Bea Beispiel (R6)"],
    result: "6:1 6:2",
    winnerSide: 1,
  });
  assert.equal(semi.matches[1]!.result, "");
  assert.equal(semi.matches[1]!.winnerSide, 0);
  assert.deepEqual(bracket.rounds[1]!.matches[0]!.side2Names, []);
});

test("mapDrawBracket übernimmt den Termin aus dem Spielplan (auch bei offenen Partien)", () => {
  const payload = drawPayload(1, [
    { level: 1, position: 0, name1: "(R4) Anna Muster" },
    { level: 1, position: 1, name1: "(R6) Bea Beispiel" },
    { level: 0, position: 0, name1: "" },
  ]);
  const schedule = scheduleWith([
    { side1: ["Anna Muster"], side2: ["Bea Beispiel"], date: "2026-07-18", time: "09:00", court: "Platz 2" },
  ]);
  const bracket = mapDrawBracket(payload, schedule)!;
  const final = bracket.rounds.find((round) => round.roundName === "Final")!.matches[0]!;
  assert.equal(final.result, "");
  assert.equal(final.scheduledDate, "2026-07-18");
  assert.equal(final.scheduledTime, "09:00");
  assert.equal(final.court, "Platz 2");
});

test("mapDrawBracket: Sieger ist die UNTERE Seite – Score steht in Siegersicht", () => {
  // Reale Konstellation (CM-Doppel): die untere Seite (Schalcher/Elsayed) gewinnt.
  // Swisstennis notiert den Score im Tableau aus SIEGERSICHT ("6/2 6/1"), nicht
  // aus Sicht der oberen Seite. Der aufgestiegene Name ist das Sieger-Signal.
  const payload = drawPayload(1, [
    { level: 1, position: 0, name1: "(R8/R8) Kolbe Daniel", name2: " / Hansjosten Victoria" },
    { level: 1, position: 1, name1: "(3) (R5/R7) Schalcher Jasmin", name2: " / Elsayed Abdullah" },
    { level: 0, position: 0, name1: "Schalcher J.", score: "6/2 6/1" },
  ]);
  const final = mapDrawBracket(payload)!.rounds[0]!.matches[0]!;
  assert.deepEqual(final.side1Names, ["Kolbe Daniel (R8)", "Hansjosten Victoria (R8)"]);
  assert.deepEqual(final.side2Names, ["(3) Schalcher Jasmin (R5)", "Elsayed Abdullah (R7)"]);
  assert.equal(final.winnerSide, 2, "die untere Seite hat gewonnen");
  // Score auf Seite-1-Sicht normiert (konsistent zu Round-robin/IC/TC).
  assert.equal(final.result, "2:6 1:6");
  assert.deepEqual(mapDrawBracket(payload)!.championNames, [
    "(3) Schalcher Jasmin (R5)",
    "Elsayed Abdullah (R7)",
  ]);
});

test("mapPoolStandings liefert die Gruppentabelle nach Rang sortiert", () => {
  const payload = {
    groupCategories: [
      {
        name: "Gruppe A",
        rankings: [
          {
            players: [{ name: "Muster Anna (R4)", id: 1 }],
            victories: "1/2",
            sets: "3/2",
            games: "20/18",
            isDouble: false,
            sort: 2,
          },
          {
            players: [{ name: "Beispiel Bea", id: 2 }],
            victories: "2/2",
            sets: "4/1",
            games: "24/12",
            isDouble: false,
            sort: 1,
          },
        ],
        games: [],
      },
    ],
  };

  const pools = mapPoolStandings(payload, false);
  assert.equal(pools.length, 1);
  assert.equal(pools[0]!.poolName, "Gruppe A");
  assert.deepEqual(
    pools[0]!.rows.map((row) => `${row.rank}.${row.names.join("/")} ${row.victories}S ${row.sets}`),
    ["1.Beispiel Bea 2S 4:1", "2.Muster Anna (R4) 1S 3:2"],
  );
  assert.equal(pools[0]!.rows[0]!.matches, 2, "die Zahl der Partien steckt im Nenner der Siege");
});

test("mapDrawBracket: Doppel-Klassierungen für beide und volle Namen in Folgerunden", () => {
  const payload = drawPayload(1, [
    { level: 1, position: 0, name1: "(R4/R3) Rosin Stephan", name2: " / Farsky Simon" },
    { level: 1, position: 1, name1: "(R6/R7) Beck Claudia", name2: " / Sirbu Laura" },
    { level: 0, position: 0, name1: "Rosin S.", score: "6/3 6/4" },
  ]);
  const bracket = mapDrawBracket(payload)!;
  const final = bracket.rounds[0]!.matches[0]!;
  assert.deepEqual(final.side1Names, ["Rosin Stephan (R4)", "Farsky Simon (R3)"]);
  assert.deepEqual(final.side2Names, ["Beck Claudia (R6)", "Sirbu Laura (R7)"]);
  assert.equal(final.winnerSide, 1);
  assert.deepEqual(bracket.championNames, ["Rosin Stephan (R4)", "Farsky Simon (R3)"]);
});

test("mapEventMatches (Draw): volle Doppelnamen auch in Folgerunden der 'Alle'-Liste", () => {
  const payload = drawPayload(2, [
    { level: 2, position: 0, name1: "(R4/R3) Rosin Stephan", name2: " / Farsky Simon" },
    { level: 2, position: 1, name1: "(R6/R7) Beck Claudia", name2: " / Sirbu Laura" },
    { level: 2, position: 2, name1: "(R5/R5) Lanker Jasmin", name2: " / Rauch Markus" },
    { level: 2, position: 3, name1: "(R4/R5) Zwick Florian", name2: " / Weckerle Carmen" },
    { level: 1, position: 0, name1: "Rosin S.", score: "6/3 6/4" },
    { level: 1, position: 1, name1: "Lanker J.", score: "6/2 6/2" },
    { level: 0, position: 0, name1: "" },
  ]);
  const schedule = scheduleWith([
    {
      side1: ["Rosin Stephan (R4)", "Farsky Simon (R3)"],
      side2: ["Lanker Jasmin (R5)", "Rauch Markus (R5)"],
      date: "2026-02-02",
      time: "10:00",
      court: "Platz 1",
    },
  ]);

  const records = mapEventMatches(payload, "Draw", "WD A", 1, true, schedule);
  const final = records.find((record) => record.roundName === "Final")!;
  assert.equal(final.player1Name, "Rosin Stephan (R4)");
  assert.equal(final.player1Name2, "Farsky Simon (R3)");
  assert.equal(final.player2Name, "Lanker Jasmin (R5)");
  assert.equal(final.player2Name2, "Rauch Markus (R5)");
  assert.equal(final.court, "Platz 1");
});
