/**
 * Gruppiert Turnier-Events in eine Damen- und eine Herren-Zeile.
 * DM (Doppel Mixed) erscheint in beiden Zeilen.
 */
import {
  compareEvents,
  MEN_DISCIPLINES,
  WOMEN_DISCIPLINES,
  type TournamentEventView,
} from "@tcw/shared";

function sortEvents(events: TournamentEventView[]): TournamentEventView[] {
  return [...events].sort(compareEvents);
}

export function womenEvents(events: TournamentEventView[]): TournamentEventView[] {
  return sortEvents(
    events.filter((event) => (WOMEN_DISCIPLINES as readonly string[]).includes(event.discipline)),
  );
}

export function menEvents(events: TournamentEventView[]): TournamentEventView[] {
  return sortEvents(
    events.filter((event) => (MEN_DISCIPLINES as readonly string[]).includes(event.discipline)),
  );
}

/** Events ohne erkennbare Disziplin (z. B. Sonderkategorien) separat anzeigen. */
export function otherEvents(events: TournamentEventView[]): TournamentEventView[] {
  return sortEvents(events.filter((event) => event.discipline === ""));
}
