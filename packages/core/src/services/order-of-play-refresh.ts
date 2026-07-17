/**
 * Gezielter Sofort-Refresh des „Order of Play": holt FRISCH von Swisstennis
 * (eigener Client mit TTL 0 → kein Cache) und aktualisiert nur die für heute
 * und morgen terminierten Matches (Termin + Ergebnis) in der DB. Der reguläre
 * 30-Minuten-Import bleibt unberührt; dieser Aufruf macht nur die aktuell
 * relevanten Spiele ohne Wartezeit sichtbar (z. B. wenn kurzfristig ein Termin
 * oder Ergebnis in Swisstennis geändert wurde).
 */
import type { AppConfig } from "../config.js";
import type { TcwDatabase } from "../db/connection.js";
import { SwisstennisClient } from "../integrations/swisstennis/raw-client.js";
import {
  displayDrawUrl,
  displayPoolsUrl,
  tournamentDisplayUrl,
} from "../integrations/swisstennis/tournament-urls.js";
import {
  mapTournamentMeta,
  type TournamentEventMeta,
} from "../integrations/swisstennis/tournament-events.js";
import { mapEventMatches, type MatchRecord } from "../integrations/swisstennis/tournament-matches.js";
import {
  readScheduledMatchKeys,
  upsertScheduledMatches,
  type TournamentConfig,
} from "./tournament-store.js";

const DOUBLE_MATCH_TYPE_IDS = new Set([3, 4, 5]);

export interface OrderOfPlayRefreshResult {
  tournamentId: number;
  /** Die berücksichtigten Tage ("YYYY-MM-DD", heute + morgen). */
  dates: string[];
  /** Wie viele frisch abgerufene Matches auf diese Tage fielen. */
  matchesScoped: number;
  /** Wie viele Zeilen tatsächlich geschrieben wurden (neu/geändert). */
  written: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Datumsstrings für heute bis heute+`daysAhead` (lokale Zeitzone). */
export function orderOfPlayDates(now: Date, daysAhead = 1): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    dates.push(localDate(day));
  }
  return dates;
}

function matchesUrlFor(eventMeta: TournamentEventMeta): string | null {
  if (eventMeta.mode === "Draw") return displayDrawUrl(eventMeta.eventId);
  if (eventMeta.mode === "Round-robin") return displayPoolsUrl(eventMeta.eventId);
  return null;
}

export async function refreshOrderOfPlay(
  config: AppConfig,
  database: TcwDatabase,
  tournamentConfig: TournamentConfig,
  now: Date = new Date(),
): Promise<OrderOfPlayRefreshResult> {
  const tournamentId = tournamentConfig.swisstennisTournamentId;
  // Eigener Client mit TTL 0 ⇒ immer frischer Abruf (umgeht den 30-Min-Cache).
  const client = new SwisstennisClient(0, config.swisstennisTimeoutMs);
  const meta = mapTournamentMeta(await client.fetchData(tournamentDisplayUrl(tournamentId)));

  const records: MatchRecord[] = [];
  for (const eventMeta of meta.events) {
    const matchesUrl = matchesUrlFor(eventMeta);
    if (!matchesUrl) continue;
    const payload = await client.fetchData(matchesUrl);
    const isDouble = DOUBLE_MATCH_TYPE_IDS.has(eventMeta.matchTypeId);
    records.push(
      ...mapEventMatches(payload, eventMeta.mode, eventMeta.eventName, eventMeta.eventId, isDouble),
    );
  }

  const dates = orderOfPlayDates(now, 1);
  const dateSet = new Set(dates);
  // Auch Matches einbeziehen, die in der DB heute/morgen terminiert sind: eine
  // gerade gespielte Partie (z. B. W/O) verliert bei Swisstennis ihren Termin und
  // faellt sonst aus dem reinen Datum-Filter – ihr Ergebnis kaeme nicht mit.
  const scheduledKeys = readScheduledMatchKeys(database, tournamentId, dates);
  const scoped = records.filter(
    (match) => dateSet.has(match.scheduledDate) || scheduledKeys.has(match.matchKey),
  );
  const written = upsertScheduledMatches(
    database,
    tournamentId,
    tournamentConfig.name,
    scoped,
    now.toISOString(),
  );
  return { tournamentId, dates, matchesScoped: scoped.length, written };
}
