/**
 * EntryPage → Liste der Interclub-Teams eines Jahres (jahresspezifische TeamIDs).
 */
import type { Gender, ResultsTeam } from "@tcw/shared";
import { asArray, cleanText, toNumber } from "./normalize.js";

interface SplitLiga {
  gender: Gender | "";
  prefix: string;
}

function splitLigaName(liga: string): SplitLiga {
  if (liga.endsWith(" Damen")) {
    return { gender: "Damen", prefix: liga.slice(0, -" Damen".length).trim() };
  }
  if (liga.endsWith(" Herren")) {
    return { gender: "Herren", prefix: liga.slice(0, -" Herren".length).trim() };
  }
  return { gender: "", prefix: liga };
}

const IC_LEAGUE_SUBSTRINGS: ReadonlyArray<[token: string, rank: number]> = [
  ["NLC", 0],
  ["1L", 1],
  ["2L", 2],
  ["3L", 3],
  ["NLB", 4],
  ["NLA", 5],
];

function leagueRank(prefix: string): number {
  const upper = prefix.toUpperCase();
  for (const [token, rank] of IC_LEAGUE_SUBSTRINGS) {
    if (upper.includes(token)) {
      return rank;
    }
  }
  return 99;
}

function ageRank(prefix: string): number {
  const first = prefix.trim()[0];
  if (first === undefined || Number.isNaN(Number(first))) {
    return 0;
  }
  const digits = /^\d+/.exec(prefix);
  return digits ? Number(digits[0]) : 0;
}

function genderRank(gender: Gender | ""): number {
  if (gender === "Damen") return 0;
  if (gender === "Herren") return 1;
  return 9;
}

interface RawEntryTeam {
  teamId?: number | string;
  icLigue?: { IcLigue?: { lgName?: string } };
  icTeamPoolSet?: { IcTeamPool?: { icPool?: { IcPool?: { poolName2?: unknown } } } };
}

export function mapEntryPageToTeams(payload: unknown): ResultsTeam[] {
  const root = payload as { I2cm?: { Mitglied?: { icTeamSet?: { IcTeam?: unknown } } } };
  const rawTeams = asArray<RawEntryTeam>(
    root.I2cm?.Mitglied?.icTeamSet?.IcTeam as RawEntryTeam | RawEntryTeam[] | undefined,
  );

  const teams: ResultsTeam[] = rawTeams
    .map((item) => {
      const teamId = toNumber(item.teamId, 0);
      const liga = cleanText(item.icLigue?.IcLigue?.lgName ?? "–") || "–";
      const { gender, prefix } = splitLigaName(liga);
      const group = item.icTeamPoolSet?.IcTeamPool?.icPool?.IcPool?.poolName2;
      return {
        teamId,
        liga,
        label: liga,
        gender,
        prefix,
        group: group == null ? "" : cleanText(group),
      };
    })
    .filter((team) => team.teamId > 0);

  return teams.sort((a, b) => {
    const byGender = genderRank(a.gender) - genderRank(b.gender);
    if (byGender !== 0) return byGender;
    const byLeague = leagueRank(a.prefix) - leagueRank(b.prefix);
    if (byLeague !== 0) return byLeague;
    const byAge = ageRank(a.prefix) - ageRank(b.prefix);
    if (byAge !== 0) return byAge;
    return a.liga.localeCompare(b.liga, "de", { sensitivity: "base" });
  });
}
