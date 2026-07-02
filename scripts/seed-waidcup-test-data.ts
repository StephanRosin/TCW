/**
 * Testdaten für die Waidcup-Website (nur manuell ausführen):
 *
 *   npm run seed:waidcup-test
 *
 * Legt ein klar erkennbares Test-Turnier an (active = 0 → taucht weder im
 * echten Import noch im Turniere-Tab der Hauptseite auf) und füllt Matches
 * mit Zeiten RELATIV zum Ausführungszeitpunkt: einige gespielt, einige laufen
 * gerade, einige stehen an. Beliebig oft wiederholbar (löscht zuvor alle
 * Zeilen des Test-Turniers).
 *
 * Die Waidcup-Website gegen diese Daten testen:
 *   WAIDCUP_TOURNAMENT_ID=999001 npm run dev:waidcup
 */
import { loadConfig, openDatabase } from "@tcw/core";

export const TEST_TOURNAMENT_ID = 999001;
const TEST_NAME = "Waidcup (Testdaten)";

interface SeedMatch {
  eventId: number;
  eventName: string;
  key: string;
  court: string;
  /** Startzeit in vollen Stunden relativ zur aktuellen vollen Stunde (negativ = Vergangenheit). */
  offsetHours: number;
  side1: [string, string?];
  side2: [string, string?];
  result?: string;
}

const EVENTS = [
  { eventId: 1, eventName: "MS A", discipline: "MS" },
  { eventId: 2, eventName: "WS A", discipline: "WS" },
  { eventId: 3, eventName: "DM A", discipline: "DM" },
];

const MATCHES: SeedMatch[] = [
  // Bereits gespielt (heute, vor einigen Stunden)
  { eventId: 1, eventName: "MS A", key: "t:ms:1", court: "Platz 1", offsetHours: -4, side1: ["Rauch Markus (R4)"], side2: ["Aepli Daniel (R4)"], result: "6:4 3:6 10:7" },
  { eventId: 2, eventName: "WS A", key: "t:ws:1", court: "Platz 2", offsetHours: -3, side1: ["Weiss Xenia (R5)"], side2: ["Rasetti Nadia (R5)"], result: "6:2 6:3" },
  { eventId: 1, eventName: "MS A", key: "t:ms:2", court: "Platz 3", offsetHours: -2, side1: ["Yuen Denis (R5)"], side2: ["Várszegi Márk (R5)"], result: "7:5 6:4" },
  // Läuft gerade (Start zur letzten bzw. vorletzten vollen Stunde, ohne Resultat)
  { eventId: 1, eventName: "MS A", key: "t:ms:3", court: "Platz 1", offsetHours: 0, side1: ["Groenveld Quinten (R5)"], side2: ["Persico Christian (R3)"] },
  { eventId: 2, eventName: "WS A", key: "t:ws:2", court: "Platz 2", offsetHours: 0, side1: ["Roth Lorena (R5)"], side2: ["Schnuck Maria (R5)"] },
  { eventId: 3, eventName: "DM A", key: "t:dm:1", court: "Platz 4", offsetHours: -1, side1: ["Yuen Denis (R5)", "Rasetti Nadia (R5)"], side2: ["Kolbe Daniel (R8)", "Mellini Karin (R7)"] },
  { eventId: 2, eventName: "WS A", key: "t:ws:3", court: "Platz 5", offsetHours: 0, side1: ["Kucera Talissa (R5)"], side2: ["Kramer Sophia (R6)"] },
  // Als Nächstes: das jeweils folgende Match – auch mal erst in 2–3 Stunden
  { eventId: 1, eventName: "MS A", key: "t:ms:4", court: "Platz 1", offsetHours: 2, side1: ["Franchini Gianluca (R2)"], side2: ["Biella Andrea (R3)"] },
  { eventId: 2, eventName: "WS A", key: "t:ws:4", court: "Platz 3", offsetHours: 1, side1: ["Wüst Martina (R5)"], side2: ["Beck Claudia (R4)"] },
  { eventId: 3, eventName: "DM A", key: "t:dm:2", court: "Platz 6", offsetHours: 3, side1: ["Rauch Markus (R4)", "Weiss Xenia (R5)"], side2: ["Aepli Daniel (R4)", "Roth Lorena (R5)"] },
  // ... und weitere Partien über den Nachmittag verteilt (längeres Testfenster)
  { eventId: 1, eventName: "MS A", key: "t:ms:6", court: "Platz 2", offsetHours: 4, side1: ["Kalayci Cem (R7)"], side2: ["Pedretti Christoph (R7)"] },
  { eventId: 2, eventName: "WS A", key: "t:ws:6", court: "Platz 4", offsetHours: 4, side1: ["Mellini Karin (R7)"], side2: ["Hansjosten Victoria (R8)"] },
  { eventId: 1, eventName: "MS A", key: "t:ms:7", court: "Platz 5", offsetHours: 5, side1: ["Issler Stefan (R7)"], side2: ["Hofer Roli (R6)"] },
  { eventId: 3, eventName: "DM A", key: "t:dm:3", court: "Platz 3", offsetHours: 5, side1: ["Yuen Denis (R5)", "Bütikofer Anne (R5)"], side2: ["Persico Christian (R3)", "Ganz Karin (R7)"] },
  { eventId: 2, eventName: "WS A", key: "t:ws:7", court: "Platz 1", offsetHours: 6, side1: ["Beck Claudia (R4)"], side2: ["Kucera Talissa (R5)"] },
  // Morgen: eine Partie mit bekannten Spielern, eine noch offene (leere Namen,
  // wie bei echten "Sieger aus ..."-Slots) – letztere darf nirgends erscheinen.
  { eventId: 2, eventName: "WS A", key: "t:ws:5", court: "Platz 1", offsetHours: 23, side1: ["Weiss Xenia (R5)"], side2: ["Wüst Martina (R5)"] },
  { eventId: 1, eventName: "MS A", key: "t:ms:5", court: "Platz 2", offsetHours: 22, side1: [""], side2: [""] },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function schedule(offsetHours: number): { date: string; time: string } {
  // Startzeiten immer zur vollen Stunde (wie im echten Turnierplan).
  const at = new Date();
  at.setMinutes(0, 0, 0);
  at.setHours(at.getHours() + offsetHours);
  return {
    date: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
    time: `${pad2(at.getHours())}:${pad2(at.getMinutes())}`,
  };
}

function main(): void {
  const config = loadConfig();
  const database = openDatabase({ filePath: config.dbFilePath });
  const now = new Date().toISOString();

  const run = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO tournaments (name, swisstennis_tournament_id, registration_url, active, sort_order)
         VALUES (@name, @id, '', 0, 99)
         ON CONFLICT(swisstennis_tournament_id) DO UPDATE SET name = excluded.name, active = 0`,
      )
      .run({ name: TEST_NAME, id: TEST_TOURNAMENT_ID });

    for (const table of ["tournament_matches", "tournament_events", "tournament_event_extras", "tournament_players"]) {
      database.prepare(`DELETE FROM ${table} WHERE tournament_id = ?`).run(TEST_TOURNAMENT_ID);
    }

    const insertEvent = database.prepare(
      `INSERT INTO tournament_events (tournament_id, event_id, tournament_name, event_name, discipline, source_descr, sort_order, updated_at)
       VALUES (@tid, @eventId, @tname, @eventName, @discipline, NULL, @eventId, @now)`,
    );
    for (const event of EVENTS) {
      insertEvent.run({ tid: TEST_TOURNAMENT_ID, tname: TEST_NAME, now, ...event });
    }

    const insertMatch = database.prepare(
      `INSERT INTO tournament_matches (
         tournament_id, event_id, match_key, tournament_name, event_name, mode,
         pool_name, round_name, scheduled_date, scheduled_time, court,
         player1_name, player1_name_2, player2_name, player2_name_2,
         result, status, winner_side, sort_order, updated_at
       ) VALUES (
         @tid, @eventId, @key, @tname, @eventName, 'Draw',
         '', @roundName, @date, @time, @court,
         @p1, @p1b, @p2, @p2b,
         @result, @status, @winnerSide, 0, @now
       )`,
    );
    for (const match of MATCHES) {
      const { date, time } = schedule(match.offsetHours);
      insertMatch.run({
        tid: TEST_TOURNAMENT_ID,
        tname: TEST_NAME,
        now,
        eventId: match.eventId,
        eventName: match.eventName,
        key: match.key,
        roundName: "Testrunde",
        date,
        time,
        court: match.court,
        p1: match.side1[0],
        p1b: match.side1[1] ?? "",
        p2: match.side2[0],
        p2b: match.side2[1] ?? "",
        result: match.result ?? "",
        status: match.result ? "played" : "open",
        winnerSide: match.result ? 1 : 0,
      });
    }
  });
  run();
  database.close();

  console.log(`Testdaten angelegt: Turnier ${TEST_TOURNAMENT_ID} („${TEST_NAME}"), ${MATCHES.length} Matches.`);
  console.log(`Testen mit: WAIDCUP_TOURNAMENT_ID=${TEST_TOURNAMENT_ID} npm run dev:waidcup`);
}

main();
