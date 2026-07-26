import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolStanding } from "@tcw/shared";
import { championLabelKey, poolChampionNames } from "./champion.js";

test("championLabelKey: Beschriftung richtet sich nach der Disziplin", () => {
  assert.equal(championLabelKey("MS"), "tournaments.champion");
  assert.equal(championLabelKey("MD"), "tournaments.champion");
  assert.equal(championLabelKey("WS"), "tournaments.championFemale");
  assert.equal(championLabelKey("WD"), "tournaments.championFemale");
  assert.equal(championLabelKey("DM"), "tournaments.championMixed");
  // Unbekannt/fehlend → neutrale Vorgabe statt Absturz
  assert.equal(championLabelKey(""), "tournaments.champion");
  assert.equal(championLabelKey(undefined), "tournaments.champion");
});

function pool(rows: Array<[number, string[], number]>, name = "Mixed"): PoolStanding[] {
  return [
    {
      poolName: name,
      rows: rows.map(([rank, names, matches]) => ({
        rank,
        names,
        matches,
        victories: 0,
        sets: "",
        games: "",
      })),
    },
  ];
}

test("poolChampionNames: fertige Gruppe liefert das Team auf Rang 1", () => {
  const pools = pool([
    [1, ["Tomass Undiks (R3)", "Nina Buck (R7)"], 3],
    [2, ["Jasmin Lanker (R2)", "Florian Zwick (R4)"], 3],
    [3, ["Stephan Rosin (R4)", "Simone Haubensak (R2)"], 3],
    [4, ["Linda Von Burg (R4)", "Tommaso Operto (R5)"], 3],
  ]);
  assert.deepEqual(poolChampionNames(pools), ["Tomass Undiks (R3)", "Nina Buck (R7)"]);
});

test("poolChampionNames: noch nicht ausgespielt → kein Sieger", () => {
  const pools = pool([
    [1, ["A", "B"], 2], // erst 2 von 3 Partien
    [2, ["C", "D"], 3],
    [3, ["E", "F"], 3],
    [4, ["G", "H"], 3],
  ]);
  assert.equal(poolChampionNames(pools), null);
});

test("poolChampionNames: mehrere Gruppen oder Gleichstand liefern keinen Sieger", () => {
  const zwei = [...pool([[1, ["A", "B"], 1], [2, ["C", "D"], 1]], "A"), ...pool([[1, ["E", "F"], 1]], "B")];
  assert.equal(poolChampionNames(zwei), null);

  const gleichstand = pool([
    [1, ["A", "B"], 2],
    [1, ["C", "D"], 2],
    [3, ["E", "F"], 2],
  ]);
  assert.equal(poolChampionNames(gleichstand), null);
});

test("poolChampionNames: ohne gelieferten Rang zählt die Reihenfolge", () => {
  const pools = pool([
    [0, ["A", "B"], 2],
    [0, ["C", "D"], 2],
    [0, ["E", "F"], 2],
  ]);
  assert.deepEqual(poolChampionNames(pools), ["A", "B"]);
});

test("poolChampionNames: leere oder einzeilige Gruppe liefert null", () => {
  assert.equal(poolChampionNames([]), null);
  assert.equal(poolChampionNames(pool([[1, ["A", "B"], 0]])), null);
});
