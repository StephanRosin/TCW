/**
 * Endstand des Waidcups: Sieger und unterlegener Finalist je Konkurrenz.
 *
 * Sobald alle Partien gespielt sind, ist der Spielplan leer und nutzlos – dann
 * tritt diese Übersicht an seine Stelle. Die Angaben stammen aus denselben
 * importierten Daten wie das Tableau:
 *  - Tableau: Sieger aus `championNames`, Finalist ist die unterlegene Seite
 *    der letzten Runde.
 *  - Round-robin: Rang 1 und Rang 2 der Gruppe.
 *
 * Konkurrenzen ohne ermittelten Sieger (abgesagt, nicht zu Ende gespielt)
 * erscheinen nicht.
 */
import type {
  PoolStanding,
  TournamentBracket,
  TournamentEventView,
  WaidcupEventResult,
  WaidcupResults,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";
import { getWaidcupBrackets } from "./waidcup-service.js";

/** Sind Partien vorhanden und ausnahmslos gespielt? */
function allMatchesPlayed(database: TcwDatabase, tournamentId: number): boolean {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status <> 'played' THEN 1 ELSE 0 END) AS open
       FROM tournament_matches WHERE tournament_id = ?`,
    )
    .get(tournamentId) as { total: number; open: number | null } | undefined;
  return !!row && row.total > 0 && (row.open ?? 0) === 0;
}

/** Sieger und Unterlegener der letzten Runde eines Tableaus. */
function fromBracket(bracket: TournamentBracket): { winner: string[]; runnerUp: string[] } | null {
  const winner = bracket.championNames;
  if (winner.length === 0) return null;
  const finale = bracket.rounds.at(-1)?.matches[0];
  if (!finale) return { winner, runnerUp: [] };
  // Der Finalverlierer ist die Seite, die nicht gewonnen hat.
  let runnerUp: string[] = [];
  if (finale.winnerSide === 1) runnerUp = finale.side2Names;
  else if (finale.winnerSide === 2) runnerUp = finale.side1Names;
  return { winner, runnerUp };
}

/** Rang 1 und Rang 2 einer Round-robin-Gruppe. */
function fromPools(pools: PoolStanding[]): { winner: string[]; runnerUp: string[] } | null {
  const pool = pools.length === 1 ? pools[0] : undefined;
  if (!pool || pool.rows.length < 2) return null;
  const ranked = [...pool.rows].sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const winner = ranked[0]?.names ?? [];
  return winner.length === 0 ? null : { winner, runnerUp: ranked[1]?.names ?? [] };
}

function resultOf(event: TournamentEventView): WaidcupEventResult | null {
  const places = event.bracket ? fromBracket(event.bracket) : fromPools(event.pools);
  if (!places) return null;
  return {
    eventId: event.eventId,
    eventName: event.eventName,
    discipline: event.discipline,
    winnerNames: places.winner,
    runnerUpNames: places.runnerUp,
  };
}

export function getWaidcupResults(database: TcwDatabase, tournamentId: number): WaidcupResults {
  if (!allMatchesPlayed(database, tournamentId)) {
    return { finished: false, events: [] };
  }
  const events = getWaidcupBrackets(database, tournamentId)
    .map(resultOf)
    .filter((result): result is WaidcupEventResult => result !== null);
  // Ohne einen einzigen ermittelten Sieger wäre die Übersicht leer – dann
  // bleibt der Spielplan stehen.
  return { finished: events.length > 0, events };
}
