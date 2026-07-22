/**
 * Check-In (Anwesenheitskontrolle) für die Waidcup-Adminseite.
 *
 * Listet je Tag alle Personen, die an dem Tag ein Match haben (bekannte Spieler),
 * mit Anwesend-Flag. Die Anwesenheit steht tagesbezogen in der Tabelle
 * `waidcup_checkin` (vorhandene Zeile = anwesend). Personen werden – wie beim
 * Bezahlt-Tracking – über den einheitlichen `waidcupPersonKey` verknüpft, damit
 * „bezahlt setzt heute automatisch anwesend" und die Order-of-Play-Anzeige exakt
 * dieselbe Person treffen.
 */
import {
  cleanPlayerName,
  waidcupPersonKey,
  type WaidcupCheckinPerson,
  type WaidcupCheckinResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

const BYE = /^(bye|noch offen)$/i;

interface DayMatchRow {
  scheduled_time: string;
  player1_name: string;
  player1_name_2: string | null;
  player2_name: string;
  player2_name_2: string | null;
}

interface PersonAcc {
  key: string;
  name: string;
  /** Früheste Startzeit der Person an dem Tag. */
  time: string;
}

function considerPlayer(persons: Map<string, PersonAcc>, rawName: string | null, time: string): void {
  if (!rawName) return;
  const clean = cleanPlayerName(rawName);
  if (clean === "" || BYE.test(clean)) return;
  const key = waidcupPersonKey(rawName);
  const existing = persons.get(key);
  if (!existing) {
    persons.set(key, { key, name: clean, time });
  } else if (time !== "" && (existing.time === "" || time < existing.time)) {
    existing.time = time;
  }
}

/** Personen mit einem für `day` angesetzten Match (nur bekannte Spieler). */
function personsPlayingOn(database: TcwDatabase, tournamentId: number, day: string): Map<string, PersonAcc> {
  const rows = database
    .prepare(
      `SELECT scheduled_time, player1_name, player1_name_2, player2_name, player2_name_2
       FROM tournament_matches
       WHERE tournament_id = ? AND scheduled_date = ?
         AND TRIM(COALESCE(player1_name, '')) <> '' AND TRIM(COALESCE(player2_name, '')) <> ''`,
    )
    .all(tournamentId, day) as DayMatchRow[];
  const persons = new Map<string, PersonAcc>();
  for (const row of rows) {
    considerPlayer(persons, row.player1_name, row.scheduled_time);
    considerPlayer(persons, row.player1_name_2, row.scheduled_time);
    considerPlayer(persons, row.player2_name, row.scheduled_time);
    considerPlayer(persons, row.player2_name_2, row.scheduled_time);
  }
  return persons;
}

/** person_keys, die an `day` als anwesend eingetragen sind. */
export function readPresentPersonKeys(database: TcwDatabase, tournamentId: number, day: string): Set<string> {
  const rows = database
    .prepare(`SELECT person_key FROM waidcup_checkin WHERE tournament_id = ? AND day = ?`)
    .all(tournamentId, day) as Array<{ person_key: string }>;
  return new Set(rows.map((row) => row.person_key));
}

export function getWaidcupCheckin(
  database: TcwDatabase,
  tournamentId: number,
  day: string,
): WaidcupCheckinResponse {
  const persons = personsPlayingOn(database, tournamentId, day);
  const present = readPresentPersonKeys(database, tournamentId, day);
  const list: WaidcupCheckinPerson[] = [];
  let presentCount = 0;
  for (const person of persons.values()) {
    const isPresent = present.has(person.key);
    if (isPresent) presentCount += 1;
    list.push({ personKey: person.key, name: person.name, matchTime: person.time, present: isPresent });
  }
  list.sort((a, b) => a.matchTime.localeCompare(b.matchTime) || a.name.localeCompare(b.name));
  return { day, persons: list, presentCount, totalCount: list.length };
}

/**
 * Setzt/entfernt die Anwesenheit einer Person an einem Tag. `present=false`
 * löscht die Zeile (auch für bereits bezahlte Personen wieder abwählbar).
 */
export function setWaidcupCheckin(
  database: TcwDatabase,
  tournamentId: number,
  personKey: string,
  day: string,
  present: boolean,
  at: string,
): void {
  if (!present) {
    database
      .prepare(`DELETE FROM waidcup_checkin WHERE tournament_id = ? AND person_key = ? AND day = ?`)
      .run(tournamentId, personKey, day);
    return;
  }
  database
    .prepare(
      `INSERT INTO waidcup_checkin (tournament_id, person_key, day, checked_in_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tournament_id, person_key, day) DO UPDATE SET checked_in_at = excluded.checked_in_at`,
    )
    .run(tournamentId, personKey, day, at);
}
