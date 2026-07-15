/**
 * Namenssuche über den Einsatzplan: findet alle Slots, in denen ein Name
 * vorkommt. Rein funktional (keine DOM-Abhängigkeit) → unit-testbar.
 *
 * Namen in einer Zelle können mehrere sein („Tim; Florine; Allison") und
 * Zusätze tragen („Tom?", „Victoria H."). Für den Vergleich werden die Namen
 * gesplittet und normalisiert (klein, ohne Zusatzzeichen); für die Anzeige
 * bleibt der Originaltext erhalten. Rollen/Wochentage bleiben als i18n-Keys –
 * übersetzt wird erst in der View.
 */
import type { DayLabel, PlanDay, RoleKey } from "./planData.js";

export interface SlotMatch {
  dayKey: string;
  weekdayKey: string;
  date: string;
  dayLabel: DayLabel;
  slot: string;
  roleKey: RoleKey;
  name: string;
}

/** Einzelnamen aus einem Zellen-String („A; B, C" → ["A","B","C"]). */
export function splitNames(raw: string): string[] {
  return raw
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** Vergleichsform: klein, ohne „?"/„." am Rand, Umlaute bleiben erhalten. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[?.]/g, "").trim();
}

/** Treffer eines einzelnen Slots (Zelle) für den normalisierten Suchbegriff. */
function slotMatches(day: PlanDay, slot: string, needle: string): SlotMatch[] {
  const cell = day.cells[slot];
  if (!cell) return [];
  const found: SlotMatch[] = [];
  for (const line of cell.lines) {
    for (const name of splitNames(line.names)) {
      if (normalize(name).includes(needle)) {
        found.push({
          dayKey: day.key,
          weekdayKey: day.weekdayKey,
          date: day.date,
          dayLabel: day.label,
          slot,
          roleKey: line.role,
          name,
        });
      }
    }
  }
  return found;
}

/**
 * Alle Slots, in denen `query` als Namensbestandteil vorkommt. Leere/zu kurze
 * Suche liefert nichts. Reihenfolge folgt Tagen und Zeitslots.
 */
export function findByName(days: readonly PlanDay[], slots: readonly string[], query: string): SlotMatch[] {
  const needle = normalize(query);
  if (needle === "") return [];
  return days.flatMap((day) => slots.flatMap((slot) => slotMatches(day, slot, needle)));
}

/** Menge der Tag-Schlüssel mit mindestens einem Treffer (für Raster-Hervorhebung). */
export function matchedDayKeys(matches: readonly SlotMatch[]): Set<string> {
  return new Set(matches.map((match) => match.dayKey));
}

/** Passt ein einzelner Name zur (nicht-leeren) Suche? Für die Zell-Hervorhebung. */
export function nameMatches(name: string, query: string): boolean {
  const needle = normalize(query);
  return needle !== "" && normalize(name).includes(needle);
}
