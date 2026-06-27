/**
 * Importierte Spieltermine (ClubResult) für die öffentliche Anzeige.
 *
 * Liefert die Begegnungen des jüngsten importierten Jahres samt Importstand.
 */
import type { MatchesResponse, PlayoffType, ScheduledMatch } from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

interface MatchRow {
  year: string;
  round: string;
  date: string;
  time: string;
  liga: string;
  home: string;
  away: string;
  result: string;
  encount_id: number;
  validated: number;
  is_home_own: number;
  playoff: number;
  playoff_type: string;
  playoff_title: string;
  playoff_ligue_id: number;
}

interface ImportStateRow {
  updated_at: string;
  source: string;
}

function toScheduledMatch(row: MatchRow): ScheduledMatch {
  return {
    round: row.round,
    date: row.date,
    time: row.time,
    liga: row.liga,
    home: row.home,
    away: row.away,
    result: row.result,
    encountId: row.encount_id,
    validated: row.validated === 1,
    year: row.year,
    isHomeOwn: row.is_home_own === 1,
    playoff: row.playoff === 1,
    playoffType: row.playoff_type as PlayoffType,
    playoffTitle: row.playoff_title,
    playoffLigueId: row.playoff_ligue_id,
  };
}

export function getMatches(database: TcwDatabase): MatchesResponse {
  const latestYearRow = database
    .prepare("SELECT year FROM matches ORDER BY year DESC LIMIT 1")
    .get() as { year: string } | undefined;
  const importState = database
    .prepare("SELECT updated_at, source FROM import_state WHERE key = 'matches'")
    .get() as ImportStateRow | undefined;

  if (!latestYearRow) {
    return { source: importState?.source ?? "", updatedAt: importState?.updated_at ?? "", year: "", matches: [] };
  }

  const rows = database
    .prepare("SELECT * FROM matches WHERE year = ? ORDER BY sort_index, id")
    .all(latestYearRow.year) as MatchRow[];

  return {
    source: importState?.source ?? "",
    updatedAt: importState?.updated_at ?? "",
    year: latestYearRow.year,
    matches: rows.map(toScheduledMatch),
  };
}
