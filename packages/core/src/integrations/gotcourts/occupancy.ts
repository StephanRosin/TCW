/**
 * Reine Aufbereitung der GotCourts-Belegung für den Plätze-Tab.
 *
 * Aus der Tagesliste werden zwei Blöcke gebildet: die aktuell laufende Stunde
 * (alle Plätze, die jetzt belegt sind) und – nur falls belegt – die folgende
 * Stunde. Zeiten sind Sekunden ab Mitternacht (GotCourts-Konvention).
 */
import type { CourtBlock, CourtBooking } from "@tcw/shared";
import type { GotCourtsReservationList, GotCourtsRawEntry } from "./client.js";

const HOUR = 3600;

interface NormalizedEntry {
  courtLabel: string;
  sortKey: number;
  startSec: number;
  endSec: number;
  who: string;
}

function hhmm(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / HOUR);
  const m = Math.floor((total % HOUR) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Erste sinnvolle Beschreibung; "-" und Leerwerte werden übersprungen. */
function describe(entry: GotCourtsRawEntry): string {
  for (const value of [entry.text, entry.shortDesc, entry.type]) {
    const trimmed = (value ?? "").trim();
    if (trimmed !== "" && trimmed !== "-") return trimmed;
  }
  return "Reserviert";
}

/** Platznummer aus dem Label ("Platz 1" → 1) für stabile Sortierung. */
function courtSortKey(label: string): number {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function normalize(list: GotCourtsReservationList): NormalizedEntry[] {
  const labelById = new Map<number, string>();
  for (const court of list.courts) {
    labelById.set(Number(court.id), court.label);
  }
  const entries: NormalizedEntry[] = [];
  for (const entry of [...list.reservations, ...list.blockings]) {
    const label = labelById.get(Number(entry.courtId));
    if (label === undefined) continue;
    entries.push({
      courtLabel: label,
      sortKey: courtSortKey(label),
      startSec: Number(entry.startTime),
      endSec: Number(entry.endTime),
      who: describe(entry),
    });
  }
  return entries;
}

/** Belegte Plätze zu einem Zeitpunkt (Sekunden), je Platz höchstens eine Buchung. */
function bookingsAt(entries: NormalizedEntry[], refSec: number): CourtBooking[] {
  const byCourt = new Map<string, NormalizedEntry>();
  for (const entry of entries) {
    if (entry.startSec <= refSec && refSec < entry.endSec && !byCourt.has(entry.courtLabel)) {
      byCourt.set(entry.courtLabel, entry);
    }
  }
  return [...byCourt.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => ({
      court: entry.courtLabel,
      from: hhmm(entry.startSec),
      to: hhmm(entry.endSec),
      who: entry.who,
    }));
}

/**
 * Baut die Anzeige-Blöcke. `nowSec` ist die aktuelle Uhrzeit in Sekunden ab
 * Mitternacht. Block 0 ist immer die laufende Stunde (auch wenn leer), Block 1
 * die Folgestunde nur, wenn dort Buchungen bestehen.
 */
export function buildCourtBlocks(list: GotCourtsReservationList, nowSec: number): CourtBlock[] {
  const entries = normalize(list);
  const currentStart = Math.floor(nowSec / HOUR) * HOUR;
  const nextStart = currentStart + HOUR;

  const blocks: CourtBlock[] = [
    {
      label: `${hhmm(currentStart)}–${hhmm(currentStart + HOUR)}`,
      live: true,
      bookings: bookingsAt(entries, nowSec),
    },
  ];
  const nextBookings = bookingsAt(entries, nextStart);
  if (nextBookings.length > 0) {
    blocks.push({
      label: `${hhmm(nextStart)}–${hhmm(nextStart + HOUR)}`,
      live: false,
      bookings: nextBookings,
    });
  }
  return blocks;
}
