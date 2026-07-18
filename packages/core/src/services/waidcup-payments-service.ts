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
  type WaidcupPaymentStatus,
  type WaidcupPaymentsResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

const SINGLES = new Set(["MS", "WS"]);
const MIXED = new Set(["DM"]);
const COST_SINGLES = 60;
const COST_MIXED = 25;
const COST_MIXED_WITH_SINGLES = 15;

interface RegistrationRow {
  event_id: number;
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

/**
 * event_ids der aktiven Konkurrenzen: eine abgesagte Konkurrenz (z. B. WS R1/R5)
 * hat weder Matches noch Tableau noch Round-robin-Pools. Nur Anmeldungen in
 * aktiven Konkurrenzen zählen für die Kosten.
 */
function activeEventIds(database: TcwDatabase, tournamentId: number): Set<number> {
  const ids = new Set<number>();
  const withMatches = database
    .prepare(`SELECT DISTINCT event_id FROM tournament_matches WHERE tournament_id = ?`)
    .all(tournamentId) as Array<{ event_id: number }>;
  for (const row of withMatches) ids.add(row.event_id);
  const withExtras = database
    .prepare(
      `SELECT event_id FROM tournament_event_extras
       WHERE tournament_id = ? AND (bracket_json IS NOT NULL OR (pools_json IS NOT NULL AND pools_json <> '[]'))`,
    )
    .all(tournamentId) as Array<{ event_id: number }>;
  for (const row of withExtras) ids.add(row.event_id);
  return ids;
}

function costFor(playsSingles: boolean, playsMixed: boolean): number {
  const singles = playsSingles ? COST_SINGLES : 0;
  let mixed = 0;
  if (playsMixed) mixed = playsSingles ? COST_MIXED_WITH_SINGLES : COST_MIXED;
  return singles + mixed;
}

export function getWaidcupPayments(database: TcwDatabase, tournamentId: number): WaidcupPaymentsResponse {
  const active = activeEventIds(database, tournamentId);
  const registrations = database
    .prepare(
      `SELECT tp.event_id, tp.player_name, tp.player_name_2, te.discipline
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
    // Anmeldungen in abgesagten Konkurrenzen ignorieren (keine Kosten).
    if (!active.has(row.event_id)) continue;
    addPerson(row.player_name, row.discipline);
    if (row.player_name_2) addPerson(row.player_name_2, row.discipline);
  }

  const firstMatch = firstMatchByPlayer(database, tournamentId);
  const statusRows = database
    .prepare(`SELECT person_key, status FROM waidcup_payments WHERE tournament_id = ?`)
    .all(tournamentId) as Array<{ person_key: string; status: string }>;
  const statusByKey = new Map<string, WaidcupPaymentStatus>();
  for (const row of statusRows) {
    if (row.status === "paid" || row.status === "cancelled") statusByKey.set(row.person_key, row.status);
  }

  const list: WaidcupPaymentPerson[] = [];
  let totalOpen = 0;
  let totalPaid = 0;
  let totalCancelled = 0;
  for (const [key, person] of persons) {
    const playsSingles = [...person.disciplines].some((discipline) => SINGLES.has(discipline));
    const playsMixed = [...person.disciplines].some((discipline) => MIXED.has(discipline));
    const cost = costFor(playsSingles, playsMixed);
    const status = statusByKey.get(key) ?? "open";
    if (status === "paid") totalPaid += cost;
    else if (status === "cancelled") totalCancelled += cost;
    else totalOpen += cost;
    const match = firstMatch.get(person.nameKey);
    list.push({
      personKey: key,
      name: person.name,
      disciplines: [...person.disciplines].sort((a, b) => a.localeCompare(b)),
      playsSingles,
      playsMixed,
      cost,
      firstMatchDate: match?.date ?? "",
      firstMatchTime: match?.time ?? "",
      status,
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { persons: list, totalOpen, totalPaid, totalCancelled };
}

/**
 * Setzt den Zahlungsstatus einer Person. „open" entfernt die Zeile (Standard),
 * „paid"/„cancelled" legen sie an bzw. aktualisieren sie. Beide gelten als
 * abgeschlossen und fallen aus dem Offen-Betrag.
 */
export function setWaidcupPayment(
  database: TcwDatabase,
  tournamentId: number,
  personKey: string,
  status: WaidcupPaymentStatus,
  at: string,
): void {
  if (status === "open") {
    database
      .prepare(`DELETE FROM waidcup_payments WHERE tournament_id = ? AND person_key = ?`)
      .run(tournamentId, personKey);
    return;
  }
  database
    .prepare(
      `INSERT INTO waidcup_payments (tournament_id, person_key, paid, paid_at, status)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(tournament_id, person_key)
       DO UPDATE SET paid = excluded.paid, paid_at = excluded.paid_at, status = excluded.status`,
    )
    .run(tournamentId, personKey, status === "paid" ? 1 : 0, at, status);
}
