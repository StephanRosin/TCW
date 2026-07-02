/**
 * Sortierung der Turnier-Matchliste, als reines Modul (ohne React) testbar.
 *
 * Drei Gruppen: gespielte Partien, anstehende mit Datum, Partien ohne Datum
 * (immer zuletzt). `order` steuert, ob gespielte oder anstehende zuoberst
 * stehen; innerhalb der Gruppen gilt: gespielte neueste zuerst, anstehende
 * nächste zuerst.
 */
import type { TournamentMatch } from "@tcw/shared";

export type MatchListOrder = "playedFirst" | "upcomingFirst";

function matchTimestamp(match: TournamentMatch): string {
  return `${match.scheduledDate}T${match.scheduledTime || "00:00"}`;
}

type MatchGroup = "played" | "upcoming" | "noDate";

function matchGroup(match: TournamentMatch): MatchGroup {
  if (match.status === "played") return "played";
  return match.scheduledDate !== "" ? "upcoming" : "noDate";
}

const GROUP_RANK: Record<MatchListOrder, Record<MatchGroup, number>> = {
  playedFirst: { played: 0, upcoming: 1, noDate: 2 },
  upcomingFirst: { upcoming: 0, played: 1, noDate: 2 },
};

/** Vergleichsfunktion für `Array.prototype.sort` in der gewünschten Reihenfolge. */
export function compareTournamentMatches(order: MatchListOrder) {
  return (a: TournamentMatch, b: TournamentMatch): number => {
    const groupA = matchGroup(a);
    const groupB = matchGroup(b);
    if (groupA !== groupB) {
      return GROUP_RANK[order][groupA] - GROUP_RANK[order][groupB];
    }
    if (groupA === "noDate") {
      return 0;
    }
    const timestampA = matchTimestamp(a);
    const timestampB = matchTimestamp(b);
    return groupA === "played"
      ? timestampB.localeCompare(timestampA)
      : timestampA.localeCompare(timestampB);
  };
}
