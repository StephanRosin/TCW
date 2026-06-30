/**
 * Reine Aufbereitung der GotCourts-Belegung für den Plätze-Tab.
 *
 * Aus der Tagesliste werden zwei Blöcke gebildet: die aktuell laufende Stunde
 * (alle Plätze, die jetzt belegt sind) und – nur falls belegt – die folgende
 * Stunde. Zeiten sind Sekunden ab Mitternacht (GotCourts-Konvention).
 */
import type { CourtBlock, CourtBooking } from "@tcw/shared";
import type { GotCourtsReservationList, GotCourtsRawEntry, GotCourtsActor } from "./client.js";

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

function clean(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed === "-" ? "" : trimmed;
}

/** Kurzname eines Buchers (player/owner): shortName, sonst aus Vor-/Nachname. */
function actorName(actor: GotCourtsActor | undefined): string {
  if (!actor) return "";
  const short = clean(actor.shortName);
  if (short !== "") return short;
  const first = clean(actor.firstname) || clean(actor.first_name);
  const last = clean(actor.lastname) || clean(actor.last_name);
  if (first !== "" && last !== "") return `${first[0]}. ${last}`;
  return clean(actor.fullName);
}

/** Namen der Mitspieler (Kurzform bevorzugt). */
function partnerNames(entry: GotCourtsRawEntry): string[] {
  return (entry.partners ?? [])
    .map((partner) => clean(partner.shortName) || clean(partner.name) || clean(partner.label))
    .filter((name) => name !== "");
}

/** Eindeutige, nicht-leere Namen in Reihenfolge. */
function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (name !== "" && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

/**
 * Vollständige Beschreibung einer Buchung: Hauptbucher (player/owner) plus alle
 * Mitspieler. Vereinsanlässe (eigene Bezeichnung in shortDesc, z. B.
 * "Clubmeisterschaften") behalten ihren Titel und hängen die Spieler an.
 */
function describe(entry: GotCourtsRawEntry): string {
  const label = clean(entry.shortDesc);
  const isEvent = label !== "";
  const booker = actorName(entry.player ?? entry.owner) || (isEvent ? "" : clean(entry.text));
  const players = uniqueNames([booker, ...partnerNames(entry)]);
  if (isEvent) {
    return players.length > 0 ? `${label} · ${players.join(", ")}` : label;
  }
  if (players.length > 0) return players.join(", ");
  return clean(entry.text) || clean(entry.type) || "Reserviert";
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
