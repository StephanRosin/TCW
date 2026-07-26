/**
 * Erkennt abgeschlossene Turniere, damit der wiederkehrende Import sie nicht
 * endlos weiter von Swisstennis abholt.
 *
 * Ein Turnier gilt als abgeschlossen, wenn es Partien gibt, ALLE gespielt sind
 * und die letzte über der Karenzzeit zurückliegt. Die Karenz lässt Platz für
 * nachträgliche Ergebniskorrekturen; danach ändert sich erfahrungsgemäss nichts
 * mehr. Ein neu aufgeschaltetes Turnier hat noch keine Partien und wird deshalb
 * ganz normal importiert – der Jahreswechsel braucht also keinen Handgriff.
 *
 * Der manuelle Sofort-Refresh der Adminseite geht an dieser Prüfung vorbei und
 * holt jederzeit frische Daten.
 */
import type { TcwDatabase } from "../db/connection.js";

/** Tage nach der letzten Partie, in denen weiter importiert wird. */
export const SETTLED_GRACE_DAYS = 7;

interface StateRow {
  total: number;
  open: number;
  lastDate: string | null;
}

/** "YYYY-MM-DD" → Tage zwischen diesem Datum und `now` (lokale Kalendertage). */
function daysSince(date: string, now: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return 0;
  const [, year, month, day] = match;
  const then = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today - then) / 86_400_000);
}

/**
 * Ist das Turnier durchgespielt und liegt die letzte Partie länger als die
 * Karenzzeit zurück? Nur dann darf der Import es überspringen.
 */
export function isTournamentSettled(
  database: TcwDatabase,
  tournamentId: number,
  now = new Date(),
  graceDays = SETTLED_GRACE_DAYS,
): boolean {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status <> 'played' THEN 1 ELSE 0 END) AS open,
              MAX(scheduled_date) AS lastDate
       FROM tournament_matches WHERE tournament_id = ?`,
    )
    .get(tournamentId) as StateRow | undefined;

  if (!row || row.total === 0) return false; // noch nicht ausgelost → importieren
  if ((row.open ?? 0) > 0) return false; // läuft noch
  const lastDate = row.lastDate ?? "";
  if (lastDate === "") return false; // ohne Termine lässt sich nichts beurteilen
  return daysSince(lastDate, now) > graceDays;
}
