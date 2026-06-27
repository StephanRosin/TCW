import assert from "node:assert/strict";
import { test } from "node:test";
import { INTERCLUB, TEAM_CHALLENGE } from "./competition.js";
import { mapEntryPageToTeams } from "./map-teams.js";
import { mapTeamResults } from "./map-team-results.js";

test("TEAM_CHALLENGE.normalize schreibt hic-Schlüssel auf die Interclub-Form um", () => {
  const hic = {
    I2cmh: {
      Mitglied: {
        icName: "Waidberg ZH",
        hicTeamSet: {
          HicTeam: [
            {
              teamId: 1599,
              hicLigue: { HicLigue: { lgName: "2L Herren" } },
              hicTeamPoolSet: { HicTeamPool: { hicPool: { HicPool: { poolName2: 5 } } } },
            },
          ],
        },
      },
    },
  };
  const norm = TEAM_CHALLENGE.normalize(hic) as {
    I2cm?: { Mitglied?: { icName?: string; icTeamSet?: { IcTeam?: Array<{ teamId?: number }> } } };
  };
  // Wert (icName) bleibt unverändert, Strukturschlüssel werden umbenannt.
  assert.equal(norm.I2cm?.Mitglied?.icName, "Waidberg ZH");
  assert.equal(norm.I2cm?.Mitglied?.icTeamSet?.IcTeam?.[0]?.teamId, 1599);

  const teams = mapEntryPageToTeams(norm);
  assert.equal(teams.length, 1);
  assert.deepEqual(
    { teamId: teams[0]!.teamId, liga: teams[0]!.liga, gender: teams[0]!.gender, group: teams[0]!.group },
    { teamId: 1599, liga: "2L Herren", gender: "Herren", group: "5" },
  );
});

test("INTERCLUB.normalize lässt die Daten unverändert", () => {
  const payload = { I2cm: { foo: "bar" } };
  assert.equal(INTERCLUB.normalize(payload), payload);
});

const COMPLETED_POOL = {
  I2cm: {
    IcLigue: { ligueId: 7, lgName: "1L Herren" },
    IcPool: {
      ended: 1,
      poolName2: "A",
      icTeamPoolSet: {
        IcTeamPool: [
          {
            poolRank: 1,
            nbMatch: 6,
            nbWonSet: 12,
            nbLostSet: 2,
            icTeam: { IcTeam: { mitglied: { Mitglied: { icName: "Waidberg ZH" } } } },
          },
          {
            poolRank: 2,
            nbMatch: 4,
            nbWonSet: 8,
            nbLostSet: 6,
            icTeam: { IcTeam: { mitglied: { Mitglied: { icName: "Gegner" } } } },
          },
        ],
      },
    },
    IcEncount: [],
  },
};

test("mapTeamResults liefert für Interclub (brackets) ein Auf-/Abstiegs-Tableau", () => {
  const result = mapTeamResults(COMPLETED_POOL, "2026", { brackets: true });
  assert.deepEqual(result.bracket, { ligueId: 7, promotion: 1, type: "promotion" });
  assert.equal(result.standings[0]?.teamName, "Waidberg ZH");
  assert.equal(result.standings[0]?.isOwn, true);
});

test("mapTeamResults unterdrückt das Tableau für Team-Challenge (brackets=false)", () => {
  const result = mapTeamResults(COMPLETED_POOL, "2026", { brackets: false });
  assert.equal(result.bracket, null);
  // Gruppenphase (Rangliste) bleibt identisch erhalten.
  assert.equal(result.standings.length, 2);
});
