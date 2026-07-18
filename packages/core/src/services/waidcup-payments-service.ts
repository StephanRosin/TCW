/**
 * Bezahlt-Tracking für die Waidcup-Adminseite.
 *
 * Zählt nur Personen, die TATSÄCHLICH in einer Konkurrenz stehen – d. h. im
 * Tableau (bracket_json), im Round-robin-Pool (pools_json) oder in den Matches
 * auftauchen. Damit fallen automatisch weg: abgesagte Konkurrenzen (haben keine
 * dieser Daten) und rein Angemeldete, die nicht ausgelost wurden. Betrag:
 *   - Einzel (MS/WS):  CHF 60 pro Person
 *   - Mixed  (DM):     CHF 25 pro Person – aber nur CHF 15, wenn die Person
 *                      auch Einzel spielt.
 * Das „bezahlt/storniert"-Flag wird in der separaten Tabelle waidcup_payments
 * gepflegt (überlebt Importe). Personen und Matches werden einheitlich über den
 * normalisierten Namens-Schlüssel (playerNameKey) verknüpft.
 */
import {
  cleanPlayerName,
  playerNameKey,
  type PoolStanding,
  type TournamentBracket,
  type WaidcupPaymentPerson,
  type WaidcupPaymentStatus,
  type WaidcupPaymentsResponse,
} from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

const BYE = /^(bye|noch offen)$/i;

const SINGLES = new Set(["MS", "WS"]);
const MIXED = new Set(["DM"]);
const COST_SINGLES = 60;
const COST_MIXED = 25;
const COST_MIXED_WITH_SINGLES = 15;

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
 * Sammelt je Person die Disziplinen, in denen sie tatsächlich spielt, aus den
 * Matches, dem Tableau (bracket_json) und den Round-robin-Pools (pools_json).
 * Rein Angemeldete ohne Auslosung und abgesagte Konkurrenzen tauchen hier nicht
 * auf. Verknüpfung über den Namens-Schlüssel.
 */
function collectPersons(database: TcwDatabase, tournamentId: number): Map<string, PersonAcc> {
  const disciplineByEvent = new Map<number, string>();
  for (const event of database
    .prepare(`SELECT event_id, discipline FROM tournament_events WHERE tournament_id = ?`)
    .all(tournamentId) as Array<{ event_id: number; discipline: string }>) {
    disciplineByEvent.set(event.event_id, event.discipline);
  }

  const persons = new Map<string, PersonAcc>();
  const add = (rawName: string, discipline: string): void => {
    const clean = cleanPlayerName(rawName);
    if (clean === "" || BYE.test(clean)) return;
    const key = personKeyFor(clean);
    let person = persons.get(key);
    if (!person) {
      person = { name: clean, nameKey: playerNameKey(rawName), disciplines: new Set() };
      persons.set(key, person);
    }
    if (discipline !== "") person.disciplines.add(discipline);
  };

  // 1) Aus den Matches (jede Seite, beide Doppelspieler).
  const matches = database
    .prepare(
      `SELECT event_id, player1_name, player1_name_2, player2_name, player2_name_2
       FROM tournament_matches WHERE tournament_id = ?`,
    )
    .all(tournamentId) as Array<{
    event_id: number;
    player1_name: string;
    player1_name_2: string | null;
    player2_name: string;
    player2_name_2: string | null;
  }>;
  for (const match of matches) {
    const discipline = disciplineByEvent.get(match.event_id) ?? "";
    for (const name of [match.player1_name, match.player1_name_2, match.player2_name, match.player2_name_2]) {
      if (name) add(name, discipline);
    }
  }

  // 2) Aus Tableau (bracket_json) und Round-robin-Pools (pools_json).
  const extras = database
    .prepare(`SELECT event_id, bracket_json, pools_json FROM tournament_event_extras WHERE tournament_id = ?`)
    .all(tournamentId) as Array<{ event_id: number; bracket_json: string | null; pools_json: string | null }>;
  for (const extra of extras) {
    const discipline = disciplineByEvent.get(extra.event_id) ?? "";
    if (extra.bracket_json) {
      const bracket = JSON.parse(extra.bracket_json) as TournamentBracket;
      for (const round of bracket.rounds) {
        for (const match of round.matches) {
          for (const name of [...match.side1Names, ...match.side2Names]) add(name, discipline);
        }
      }
    }
    if (extra.pools_json && extra.pools_json !== "[]") {
      const pools = JSON.parse(extra.pools_json) as PoolStanding[];
      for (const pool of pools) {
        for (const row of pool.rows) {
          for (const name of row.names) add(name, discipline);
        }
      }
    }
  }
  return persons;
}

function costFor(playsSingles: boolean, playsMixed: boolean): number {
  const singles = playsSingles ? COST_SINGLES : 0;
  let mixed = 0;
  if (playsMixed) mixed = playsSingles ? COST_MIXED_WITH_SINGLES : COST_MIXED;
  return singles + mixed;
}

export function getWaidcupPayments(database: TcwDatabase, tournamentId: number): WaidcupPaymentsResponse {
  const persons = collectPersons(database, tournamentId);
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
