/**
 * Lesedienst der Waidcup-Website: Events/Tableaux, Matchliste und das
 * Live-Board („Wer spielt gerade") aus den lokal importierten Turnierdaten.
 *
 * Live-Definition: Eine Partie „läuft", wenn sie heute terminiert ist, die
 * Startzeit erreicht ist, sie höchstens `MAX_LIVE_MATCH_HOURS` zurückliegt und
 * noch kein Resultat erfasst wurde (`status = 'open'`). Sobald ein Ergebnis
 * eingetragen wird, springt `status` auf `'played'` und die Partie verschwindet
 * automatisch. Die Zeitobergrenze verhindert, dass eine Partie ohne erfasstes
 * Resultat den ganzen Abend als „laufend" hängen bleibt.
 */
import {
  type TournamentEventView,
  type TournamentMatch,
  type WaidcupLiveMatch,
  type WaidcupLiveResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";
import { resolveUrlsForNames } from "./player-registry.js";
import { loadTournamentEvents } from "./tournament-store.js";

/** Alle Events des Waidcups inkl. Tableau/Pools (für die Turnierbaum-Seite). */
export function getWaidcupBrackets(database: TcwDatabase, tournamentId: number): TournamentEventView[] {
  return loadTournamentEvents(database, tournamentId).events;
}

/**
 * Spieler-Profil-Links (mytennis.ch) je normalisiertem Namensschlüssel, für alle
 * in den Matches des Turniers vorkommenden Spieler. Löst über das zentrale
 * Spieler-Register auf (nicht nur über `tournament_players` dieses Turniers),
 * damit ein Link auch dann erscheint, wenn die URL aus einer anderen Quelle
 * (z. B. Kader oder einem anderen Turnier) bekannt ist. Mehrdeutige Namen
 * liefern keinen Treffer (siehe `resolveUrlsForNames`).
 */
export function getWaidcupPlayerUrls(database: TcwDatabase, tournamentId: number): Record<string, string> {
  const rows = database
    .prepare(
      `SELECT player1_name, player1_name_2, player2_name, player2_name_2
         FROM tournament_matches WHERE tournament_id = ?`,
    )
    .all(tournamentId) as Array<{
    player1_name: string | null;
    player1_name_2: string | null;
    player2_name: string | null;
    player2_name_2: string | null;
  }>;

  const names: string[] = [];
  for (const row of rows) {
    for (const name of [row.player1_name, row.player1_name_2, row.player2_name, row.player2_name_2]) {
      if (name && name.trim() !== "") names.push(name);
    }
  }
  return resolveUrlsForNames(database, names);
}

/** Beide Seiten besetzt? Platzhalter (z. B. „Sieger aus …" = leere Namen) bleiben aussen vor. */
function hasKnownSides(match: TournamentMatch): boolean {
  return match.side1Names.length > 0 && match.side2Names.length > 0;
}

/** Alle Matches des Waidcups mit bekannten Spielern (Filter/Sortierung macht das Frontend). */
export function getWaidcupMatches(database: TcwDatabase, tournamentId: number): TournamentMatch[] {
  return loadTournamentEvents(database, tournamentId)
    .events.flatMap((event) => event.matches)
    .filter(hasKnownSides);
}

interface LiveRow {
  event_name: string;
  court: string | null;
  scheduled_date: string;
  scheduled_time: string;
  player1_name: string;
  player1_name_2: string | null;
  player2_name: string;
  player2_name_2: string | null;
}

/**
 * Maximale Zeitspanne (Stunden), die eine Partie ab Startzeit als „laufend"
 * gilt. Verhindert, dass eine Partie ohne erfasstes Resultat den ganzen Abend
 * als „laufend" hängen bleibt.
 */
const MAX_LIVE_MATCH_HOURS = 2;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function sideNames(name: string, name2: string | null): string[] {
  return [name, name2 ?? ""].map((value) => value.trim()).filter((value) => value !== "");
}

function toLiveMatch(row: LiveRow): WaidcupLiveMatch {
  return {
    court: (row.court ?? "").trim(),
    eventName: row.event_name,
    side1Names: sideNames(row.player1_name, row.player1_name_2),
    side2Names: sideNames(row.player2_name, row.player2_name_2),
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
  };
}

/** Platznummern natürlich sortieren ("Platz 2" vor "Platz 10"). */
function courtSortKey(court: string): number {
  const match = court.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

/**
 * Live-Board: laufende Partien (nach Platz) und die nächsten Partien (nach
 * Zeitpunkt, gedeckelt). `now` ist injizierbar für Tests.
 */
export function getWaidcupLive(
  database: TcwDatabase,
  tournamentId: number,
  now: Date = new Date(),
): WaidcupLiveResponse {
  const rows = database
    .prepare(
      `SELECT event_name, court, scheduled_date, scheduled_time,
              player1_name, player1_name_2, player2_name, player2_name_2
       FROM tournament_matches
       WHERE tournament_id = ? AND status = 'open'
         AND TRIM(COALESCE(scheduled_date, '')) <> ''
         AND TRIM(COALESCE(scheduled_time, '')) <> ''
         AND TRIM(COALESCE(player1_name, '')) <> ''
         AND TRIM(COALESCE(player2_name, '')) <> ''`,
    )
    .all(tournamentId) as LiveRow[];

  const today = localDate(now);
  const nowTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  // Untergrenze für „laufend": Partien, deren Startzeit länger als
  // MAX_LIVE_MATCH_HOURS zurückliegt, gelten nicht mehr als live (schützt vor
  // Partien, deren Resultat nie erfasst wurde). Liegt das Fenster vor
  // Mitternacht, greift für heutige Partien „00:00".
  const windowStart = new Date(now.getTime() - MAX_LIVE_MATCH_HOURS * 3_600_000);
  const earliestLiveTime =
    localDate(windowStart) === today
      ? `${pad2(windowStart.getHours())}:${pad2(windowStart.getMinutes())}`
      : "00:00";

  // „Jetzt auf dem Platz": pro Platz nur die zuletzt gestartete Partie – ist
  // das Resultat der vorherigen noch nicht erfasst, verdrängt die neuere sie.
  const startedByTimeDesc = rows
    .filter(
      (row) =>
        (row.court ?? "").trim() !== "" &&
        row.scheduled_date === today &&
        row.scheduled_time <= nowTime &&
        row.scheduled_time >= earliestLiveTime,
    )
    .sort((a, b) => b.scheduled_time.localeCompare(a.scheduled_time));
  const latestPerCourt = new Map<string, LiveRow>();
  for (const row of startedByTimeDesc) {
    const court = (row.court ?? "").trim();
    if (!latestPerCourt.has(court)) latestPerCourt.set(court, row);
  }
  const live = [...latestPerCourt.values()]
    .map(toLiveMatch)
    .sort((a, b) => courtSortKey(a.court) - courtSortKey(b.court));

  // „Als Nächstes": pro Platz genau die eine, zeitlich nächste Partie – nur
  // vom heutigen Tag (Folgetage gehören nicht aufs Live-Board). Nach Platz
  // sortiert.
  const futureByTime = rows
    .filter(
      (row) =>
        (row.court ?? "").trim() !== "" &&
        row.scheduled_date === today &&
        row.scheduled_time > nowTime,
    )
    .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
  const nextPerCourt = new Map<string, LiveRow>();
  for (const row of futureByTime) {
    const court = (row.court ?? "").trim();
    if (!nextPerCourt.has(court)) nextPerCourt.set(court, row);
  }
  const upcoming = [...nextPerCourt.values()]
    .map(toLiveMatch)
    .sort((a, b) => courtSortKey(a.court) - courtSortKey(b.court));

  return { now: live, upcoming };
}

/**
 * Tagesspielplan („Order of Play"): alle für einen Tag terminierten Partien mit
 * bekanntem Platz, Zeit und beiden Spielern – unabhängig vom Status
 * (gespielt/laufend/anstehend). `dayOffset` verschiebt den Tag (0 = heute,
 * 1 = morgen). Sortiert nach Zeit, dann Platz.
 */
export function getWaidcupOrderOfPlay(
  database: TcwDatabase,
  tournamentId: number,
  now: Date = new Date(),
  dayOffset = 0,
): WaidcupLiveMatch[] {
  const base = new Date(now);
  base.setDate(base.getDate() + dayOffset);
  const today = localDate(base);
  const rows = database
    .prepare(
      `SELECT event_name, court, scheduled_date, scheduled_time,
              player1_name, player1_name_2, player2_name, player2_name_2
       FROM tournament_matches
       WHERE tournament_id = ? AND scheduled_date = ?
         AND TRIM(COALESCE(scheduled_time, '')) <> ''
         AND TRIM(COALESCE(court, '')) <> ''
         AND TRIM(COALESCE(player1_name, '')) <> ''
         AND TRIM(COALESCE(player2_name, '')) <> ''
       ORDER BY scheduled_time`,
    )
    .all(tournamentId, today) as LiveRow[];
  return rows
    .map(toLiveMatch)
    .sort(
      (a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime) || courtSortKey(a.court) - courtSortKey(b.court),
    );
}
