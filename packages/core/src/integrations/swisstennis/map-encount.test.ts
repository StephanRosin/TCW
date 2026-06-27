import assert from "node:assert/strict";
import { test } from "node:test";
import { mapEncountDetail } from "./map-encount.js";

function payloadWith(matches: unknown[]): unknown {
  return {
    I2cm: {
      EncountResults: {
        Encount: {
          EncountInfo: {
            Home: { Team: { name: "Waidberg ZH", clubNb: 1298 } },
            Visit: { Team: { name: "Grenchen" } },
          },
          Singles: { Match: matches },
        },
      },
    },
  };
}

function singlesMatch(name: number, home: object, visit: object, homeScore: object, visitScore: object): object {
  return {
    name,
    Players: { Home: { Player: home }, Visit: { Player: visit } },
    Scores: { Home: homeScore, Visit: visitScore },
  };
}

test("Walkover mit Teilergebnis: wo=1 ist der Sieger, Satzstand bleibt sichtbar", () => {
  // Reale Konstellation (EncountId 973496, Pos 3): Aepli (Home) gewinnt per
  // Aufgabe nach 3:6 6:3 – sein Score trägt wo=1.
  const detail = mapEncountDetail(
    payloadWith([
      singlesMatch(
        3,
        { name: "Aepli Daniel" },
        { name: "Caccivio Thomas" },
        { wo: 1, sg1: 3, sg2: 6, sg3: -1 },
        { wo: 0, sg1: 6, sg2: 3, sg3: -1 },
      ),
    ]),
    973496,
    "2026",
    "encount",
  );

  const match = detail.singles[0]!;
  assert.equal(match.score, "3:6 6:3 w.o.");
  assert.equal(match.walkover, true);
  assert.equal(match.homeWon, true); // Home (Aepli) hat gewonnen
});

test("Reiner Walkover ohne gespielte Sätze zeigt nur 'w.o.' und den korrekten Sieger", () => {
  const detail = mapEncountDetail(
    payloadWith([
      singlesMatch(
        1,
        { name: "Heim Spieler" },
        { name: "Gast Sieger" },
        { wo: 0, sg1: -1, sg2: -1, sg3: -1 },
        { wo: 1, sg1: -1, sg2: -1, sg3: -1 },
      ),
    ]),
    1,
    "2026",
    "encount",
  );

  const match = detail.singles[0]!;
  assert.equal(match.score, "w.o.");
  assert.equal(match.walkover, true);
  assert.equal(match.homeWon, false); // Visit trägt wo=1 → Visit gewinnt
});

test("Reguläre Partie ohne Walkover bestimmt den Sieger aus den Sätzen", () => {
  const detail = mapEncountDetail(
    payloadWith([
      singlesMatch(
        2,
        { name: "Grüter Pius", class: "R3" },
        { name: "Caccivio Daniel" },
        { wo: 0, sg1: 6, sg2: 6, sg3: -1 },
        { wo: 0, sg1: 1, sg2: 0, sg3: -1 },
      ),
    ]),
    2,
    "2026",
    "encount",
  );

  const match = detail.singles[0]!;
  assert.equal(match.score, "6:1 6:0");
  assert.equal(match.walkover, false);
  assert.equal(match.homeWon, true);
  assert.deepEqual(match.homeNames, ["Grüter Pius (R3)"]);
});
