/**
 * Spielplan eines Turniers als Nachschlagewerk.
 *
 * Datum, Uhrzeit und Platz stehen seit dem 19.08.2026 nicht mehr bei der
 * einzelnen Partie, sondern nur noch im Endpunkt `game-plan`. Der liefert
 * ausschliesslich einzelne Tage: Start- und Enddatum müssen denselben Tag
 * meinen, sonst antwortet er mit HTTP 200 und leerer Platzliste. Deshalb wird
 * der Turnierzeitraum tageweise abgefragt.
 *
 * Zugeordnet wird über die Namen, weil die Partien keine gemeinsame ID haben.
 */
import { asArray, cleanText } from "./normalize.js";
import { gamePlanUrl } from "./tournament-urls.js";

export interface ScheduleEntry {
  date: string;
  time: string;
  court: string;
}

export type ScheduleIndex = Map<string, ScheduleEntry>;

interface RawGamePlanMatch {
  players?: string[];
  opponents?: string[];
  hour?: string;
}

/** Setznummer "(1)" oder Klassierung "(R4/R3)", "(NC)" – auch mehrfach. */
const RANKING_TOKEN = /\((?:\d+|[NR]\d+|NC)(?:\/(?:[NR]\d+|NC))*\)/g;

/**
 * Vergleicht nach Zeichenwert, nicht nach Sprachregeln – der Schlüssel muss
 * über Anwendungen und Sprachen hinweg derselbe sein.
 */
function byCodeUnit(first: string, second: string): number {
  if (first < second) return -1;
  return first > second ? 1 : 0;
}

/** Vergleichsschlüssel einer Person: ohne Klassierung, klein, Wörter sortiert. */
function personKey(name: string): string {
  const withoutRanking = cleanText(name).replace(RANKING_TOKEN, " ");
  return (withoutRanking.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).sort(byCodeUnit).join(" ");
}

function teamKey(names: string[]): string {
  return names.filter((name) => cleanText(name) !== "").map(personKey).sort(byCodeUnit).join("+");
}

/** Schlüssel einer Paarung – unabhängig davon, welche Seite zuerst steht. */
export function scheduleKey(firstTeam: string[], secondTeam: string[]): string {
  return [teamKey(firstTeam), teamKey(secondTeam)].sort(byCodeUnit).join("|");
}

export function scheduleFor(
  index: ScheduleIndex | undefined,
  firstTeam: string[],
  secondTeam: string[],
): ScheduleEntry {
  return index?.get(scheduleKey(firstTeam, secondTeam)) ?? { date: "", time: "", court: "" };
}

/** `7/18/2026` (so liefert es die API) → `2026-07-18`. */
export function parseApiDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleanText(value));
  if (!match) return "";
  return `${match[3]}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

/** Baut den Index aus einer bereits geladenen Tagesantwort. */
export function addGamePlanDay(index: ScheduleIndex, isoDate: string, payload: unknown): void {
  for (const court of asArray<{ name?: string; matches?: unknown }>(
    (payload as { courts?: unknown } | null)?.courts as never,
  )) {
    const courtName = cleanText(court.name ?? "");
    for (const match of asArray<RawGamePlanMatch>(court.matches as never)) {
      const key = scheduleKey(asArray<string>(match.players as never), asArray<string>(match.opponents as never));
      if (!index.has(key)) {
        index.set(key, { date: isoDate, time: cleanText(match.hour ?? ""), court: courtName });
      }
    }
  }
}

/** Alle Tage eines Zeitraums abklappern (Grenze gegen Ausreisser: maxDays). */
export async function loadTournamentSchedule(
  fetchJson: (url: string) => Promise<unknown>,
  tournamentId: number,
  startTime: string,
  endTime: string,
  maxDays = 70,
): Promise<ScheduleIndex> {
  const index: ScheduleIndex = new Map();
  const start = parseApiDate(startTime);
  const end = parseApiDate(endTime);
  if (start === "" || end === "") return index;

  const day = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  for (let days = 0; day <= last && days < maxDays; days += 1) {
    const iso = day.toISOString().slice(0, 10);
    const [year, month, dayOfMonth] = iso.split("-");
    try {
      addGamePlanDay(index, iso, await fetchJson(gamePlanUrl(tournamentId, `${dayOfMonth}.${month}.${year}`)));
    } catch {
      // Ein einzelner Tag ohne Antwort darf den ganzen Spielplan nicht kippen.
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return index;
}
