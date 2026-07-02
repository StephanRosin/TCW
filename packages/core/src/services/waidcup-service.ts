/**
 * Lesedienst der Waidcup-Website: Events/Tableaux, Matchliste und das
 * Live-Board („Wer spielt gerade") aus den lokal importierten Turnierdaten.
 *
 * Live-Definition ohne künstliche Spieldauer: Eine Partie „läuft", wenn sie
 * heute terminiert ist, die Startzeit erreicht ist und noch kein Resultat
 * erfasst wurde (`status = 'open'`). Sobald ein Ergebnis eingetragen wird,
 * springt `status` auf `'played'` und die Partie verschwindet automatisch.
 */
import type {
  TournamentEventView,
  TournamentMatch,
  WaidcupLiveMatch,
  WaidcupLiveResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";
import { loadTournamentEvents } from "./tournament-store.js";

/** Obergrenze für „Als Nächstes", damit das Board übersichtlich bleibt. */
const UPCOMING_LIMIT = 12;

/** Alle Events des Waidcups inkl. Tableau/Pools (für die Turnierbaum-Seite). */
export function getWaidcupBrackets(database: TcwDatabase, tournamentId: number): TournamentEventView[] {
  return loadTournamentEvents(database, tournamentId).events;
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

  const live = rows
    .filter((row) => row.scheduled_date === today && row.scheduled_time <= nowTime)
    .map(toLiveMatch)
    .sort((a, b) => courtSortKey(a.court) - courtSortKey(b.court));

  const upcoming = rows
    .filter(
      (row) =>
        row.scheduled_date > today ||
        (row.scheduled_date === today && row.scheduled_time > nowTime),
    )
    .sort((a, b) =>
      `${a.scheduled_date}T${a.scheduled_time}`.localeCompare(`${b.scheduled_date}T${b.scheduled_time}`),
    )
    .slice(0, UPCOMING_LIMIT)
    .map(toLiveMatch);

  return { now: live, upcoming };
}
