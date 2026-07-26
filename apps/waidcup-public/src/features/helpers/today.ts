/**
 * Ermittelt, welcher Plantag der heutige ist – Grundlage dafür, dass der
 * Einsatzplan am Turniertag direkt beim aktuellen Tag aufgeht statt beim
 * ersten. Verglichen wird der Kalendertag in lokaler Zeit; liegt heute
 * ausserhalb des Turniers, gibt es keinen aktuellen Tag.
 */
import type { PlanDay } from "./planData.js";

const DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** Entspricht "26.07.2026" dem Kalendertag von `now`? */
function isSameDay(date: string, now: Date): boolean {
  const match = DATE.exec(date);
  if (!match) return false;
  const [, day, month, year] = match;
  return (
    Number(year) === now.getFullYear() &&
    Number(month) === now.getMonth() + 1 &&
    Number(day) === now.getDate()
  );
}

/** Key des heutigen Plantags, sonst `null`. */
export function currentDayKey(days: readonly PlanDay[], now: Date): string | null {
  return days.find((day) => isSameDay(day.date, now))?.key ?? null;
}
