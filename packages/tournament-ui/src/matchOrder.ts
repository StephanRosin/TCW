/**
 * Sortierung der Turnier-Matchliste, als reines Modul (ohne React) testbar.
 *
 * Drei Gruppen: gespielte Partien, anstehende mit Datum, Partien ohne Datum
 * (immer zuletzt). `order` steuert, ob gespielte oder anstehende zuoberst
 * stehen; innerhalb der Gruppen gilt: gespielte neueste zuerst, anstehende
 * nächste zuerst.
 *
 * Sonderfall Walkover: solche Partien gelten als gespielt, wurden aber nie
 * angesetzt und haben deshalb kein Datum. Statt ohne Bezug am Rand zu landen,
 * erben sie den Termin ihrer Runde (ersatzweise den ihrer Konkurrenz) und
 * stehen damit bei ihren Runden-Geschwistern – dort sucht man sie.
 */
import type { TournamentMatch } from "@tcw/shared";

export type MatchListOrder = "playedFirst" | "upcomingFirst";

type MatchGroup = "played" | "upcoming" | "noDate";

const GROUP_RANK: Record<MatchListOrder, Record<MatchGroup, number>> = {
  playedFirst: { played: 0, upcoming: 1, noDate: 2 },
  upcomingFirst: { upcoming: 0, played: 1, noDate: 2 },
};

/** Eigener Termin als sortierbarer Zeitstempel; ohne Datum leer. */
function ownTimestamp(match: TournamentMatch): string {
  return match.scheduledDate === "" ? "" : `${match.scheduledDate}T${match.scheduledTime || "00:00"}`;
}

function roundKey(match: TournamentMatch): string {
  return `${match.eventId}|${match.roundName}`;
}

/** Frühester Termin je Runde und je Konkurrenz – Ersatztermin für Partien ohne Datum. */
function earliestTimestamps(matches: readonly TournamentMatch[]): {
  byRound: Map<string, string>;
  byEvent: Map<number, string>;
} {
  const byRound = new Map<string, string>();
  const byEvent = new Map<number, string>();
  for (const match of matches) {
    const timestamp = ownTimestamp(match);
    if (timestamp === "") continue;
    const round = byRound.get(roundKey(match));
    if (round === undefined || timestamp < round) byRound.set(roundKey(match), timestamp);
    const event = byEvent.get(match.eventId);
    if (event === undefined || timestamp < event) byEvent.set(match.eventId, timestamp);
  }
  return { byRound, byEvent };
}

/**
 * Sortiert eine Matchliste in der gewünschten Reihenfolge. Anders als eine reine
 * Vergleichsfunktion kennt sie die ganze Liste und kann Partien ohne Datum
 * darüber bei ihrer Runde einordnen.
 */
export function sortTournamentMatches(
  matches: readonly TournamentMatch[],
  order: MatchListOrder,
): TournamentMatch[] {
  const { byRound, byEvent } = earliestTimestamps(matches);
  const entries = matches.map((match) => {
    const own = ownTimestamp(match);
    // Nur gespielte Partien erben einen Termin: eine noch nicht angesetzte
    // Partie hat tatsächlich keinen und gehört ans Ende.
    const inheritable = match.status === "played" && own === "";
    const timestamp = inheritable
      ? byRound.get(roundKey(match)) ?? byEvent.get(match.eventId) ?? ""
      : own;
    let group: MatchGroup = "noDate";
    if (match.status === "played") group = "played";
    else if (own !== "") group = "upcoming";
    return { match, timestamp, inherited: inheritable && timestamp !== "", group };
  });

  entries.sort((a, b) => {
    if (a.group !== b.group) return GROUP_RANK[order][a.group] - GROUP_RANK[order][b.group];
    // Ohne jeden (auch geerbten) Termin ans Ende der eigenen Gruppe.
    if (a.timestamp === "" || b.timestamp === "") {
      return a.timestamp === b.timestamp ? 0 : a.timestamp === "" ? 1 : -1;
    }
    const byTime =
      a.group === "played"
        ? b.timestamp.localeCompare(a.timestamp)
        : a.timestamp.localeCompare(b.timestamp);
    if (byTime !== 0) return byTime;
    // Gleicher Termin: die Partie mit eigenem Termin zuerst, die geerbte danach.
    return Number(a.inherited) - Number(b.inherited);
  });

  return entries.map((entry) => entry.match);
}
