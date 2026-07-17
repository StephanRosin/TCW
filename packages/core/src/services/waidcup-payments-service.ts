/**
 * Bezahlt-Tracking für die Waidcup-Adminseite.
 *
 * Aggregiert die Anmeldungen (tournament_players) je Person über alle
 * Konkurrenzen und berechnet den zu zahlenden Betrag:
 *   - Einzel (MS/WS):  CHF 60 pro Person
 *   - Mixed  (DM):     CHF 25 pro Person – aber nur CHF 15, wenn die Person
 *                      auch Einzel spielt.
 * Das „bezahlt"-Flag wird in der separaten Tabelle waidcup_payments gepflegt
 * (überlebt Importe). Personen und Matches werden einheitlich über den
 * normalisierten Namens-Schlüssel (playerNameKey) verknüpft – robust auch wenn
 * die Register-Verknüpfung (registry_id) mal fehlt, und stabil über Importe.
 */
import {
  cleanPlayerName,
  playerNameKey,
  type WaidcupPaymentPerson,
  type WaidcupPaymentsResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

const SINGLES = new Set(["MS", "WS"]);
const MIXED = new Set(["DM"]);
const COST_SINGLES = 60;
const COST_MIXED = 25;
const COST_MIXED_WITH_SINGLES = 15;

interface RegistrationRow {
  player_name: string;
  player_name_2: string | null;
  discipline: string;
}

interface MatchNameRow {
  scheduled_date: string;
  scheduled_time: string;
  player1_name: string;
  player1_name_2: string | null;
  player2_name: string;
  player2_name_2: string | null;
}

interface PersonAcc {
  name: string;
  nameKey: string;
  disciplines: Set<string>;
}

interface FirstMatch {
  date: string;
  time: string;
}

function personKeyFor(name: string): string {
  return `name:${playerNameKey(name)}`;
}

/** Frühestes terminiertes Match je Spieler-Namens-Schlüssel. */
function firstMatchByPlayer(database: TcwDatabase, tournamentId: number): Map<string, FirstMatch> {
  const rows = database
    .prepare(
      `SELECT scheduled_date, scheduled_time, player1_name, player1_name_2, player2_name, player2_name_2
       FROM tournament_matches
       WHERE tournament_id = ?
         AND TRIM(COALESCE(scheduled_date, '')) <> ''
         AND TRIM(COALESCE(scheduled_time, '')) <> ''`,
    )
    .all(tournamentId) as MatchNameRow[];
  const map = new Map<string, FirstMatch>();
  const consider = (name: string | null, date: string, time: string): void => {
    if (!name || name.trim() === "") return;
    const key = playerNameKey(name);
    const current = map.get(key);
    if (!current || date < current.date || (date === current.date && time < current.time)) {
      map.set(key, { date, time });
    }
  };
  for (const row of rows) {
    consider(row.player1_name, row.scheduled_date, row.scheduled_time);
    consider(row.player1_name_2, row.scheduled_date, row.scheduled_time);
    consider(row.player2_name, row.scheduled_date, row.scheduled_time);
    consider(row.player2_name_2, row.scheduled_date, row.scheduled_time);
  }
  return map;
}

function costFor(playsSingles: boolean, playsMixed: boolean): number {
  const singles = playsSingles ? COST_SINGLES : 0;
  let mixed = 0;
  if (playsMixed) mixed = playsSingles ? COST_MIXED_WITH_SINGLES : COST_MIXED;
  return singles + mixed;
}

export function getWaidcupPayments(database: TcwDatabase, tournamentId: number): WaidcupPaymentsResponse {
  const registrations = database
    .prepare(
      `SELECT tp.player_name, tp.player_name_2, te.discipline
       FROM tournament_players tp
       JOIN tournament_events te
         ON te.tournament_id = tp.tournament_id AND te.event_id = tp.event_id
       WHERE tp.tournament_id = ?`,
    )
    .all(tournamentId) as RegistrationRow[];

  const persons = new Map<string, PersonAcc>();
  const addPerson = (name: string, discipline: string): void => {
    const clean = cleanPlayerName(name);
    if (clean === "") return;
    const key = personKeyFor(clean);
    let person = persons.get(key);
    if (!person) {
      person = { name: clean, nameKey: playerNameKey(name), disciplines: new Set() };
      persons.set(key, person);
    }
    if (discipline !== "") person.disciplines.add(discipline);
  };
  for (const row of registrations) {
    addPerson(row.player_name, row.discipline);
    if (row.player_name_2) addPerson(row.player_name_2, row.discipline);
  }

  const firstMatch = firstMatchByPlayer(database, tournamentId);
  const paidRows = database
    .prepare(`SELECT person_key, paid FROM waidcup_payments WHERE tournament_id = ?`)
    .all(tournamentId) as Array<{ person_key: string; paid: number }>;
  const paidKeys = new Set(paidRows.filter((row) => row.paid).map((row) => row.person_key));

  const list: WaidcupPaymentPerson[] = [];
  let totalOpen = 0;
  let totalPaid = 0;
  for (const [key, person] of persons) {
    const playsSingles = [...person.disciplines].some((discipline) => SINGLES.has(discipline));
    const playsMixed = [...person.disciplines].some((discipline) => MIXED.has(discipline));
    const cost = costFor(playsSingles, playsMixed);
    const paid = paidKeys.has(key);
    if (paid) totalPaid += cost;
    else totalOpen += cost;
    const match = firstMatch.get(person.nameKey);
    list.push({
      personKey: key,
      name: person.name,
      disciplines: [...person.disciplines].sort(),
      playsSingles,
      playsMixed,
      cost,
      firstMatchDate: match?.date ?? "",
      firstMatchTime: match?.time ?? "",
      paid,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { persons: list, totalOpen, totalPaid };
}

/** Setzt/entfernt das Bezahlt-Flag einer Person. */
export function setWaidcupPayment(
  database: TcwDatabase,
  tournamentId: number,
  personKey: string,
  paid: boolean,
  paidAt: string,
): void {
  database
    .prepare(
      `INSERT INTO waidcup_payments (tournament_id, person_key, paid, paid_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(tournament_id, person_key)
       DO UPDATE SET paid = excluded.paid, paid_at = excluded.paid_at`,
    )
    .run(tournamentId, personKey, paid ? 1 : 0, paid ? paidAt : null);
}
