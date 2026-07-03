/**
 * Testdaten für die Waidcup-Website (nur manuell ausführen):
 *
 *   npm run seed:waidcup-test
 *
 * Legt ein klar erkennbares Test-Turnier an (active = 0 → taucht weder im
 * echten Import noch im Turniere-Tab der Hauptseite auf) und füllt Matches
 * mit Zeiten RELATIV zum Ausführungszeitpunkt: einige gespielt, einige laufen
 * gerade, einige stehen an. Derselbe Tagesplan wird zusätzlich für die
 * nächsten 5 Tage dupliziert (identische Partien, Datum verschoben), damit
 * über mehrere Tage getestet werden kann. Beliebig oft wiederholbar (löscht
 * zuvor alle Zeilen des Test-Turniers).
 *
 * Die Waidcup-Website gegen diese Daten testen:
 *   WAIDCUP_TOURNAMENT_ID=999001 npm run dev:waidcup
 */
import { loadConfig, openDatabase } from "@tcw/core";

export const TEST_TOURNAMENT_ID = 999001;
const TEST_NAME = "Waidcup (Testdaten)";
/** Der Tagesplan wird für so viele Folgetage identisch wiederholt. */
const EXTRA_DAYS = 5;

interface SeedMatch {
  eventId: number;
  eventName: string;
  key: string;
  court: string;
  /** Feste Startzeit "HH:MM" (Tagesraster für den Order-of-Play-Test). */
  time: string;
  side1: [string, string?];
  side2: [string, string?];
  result?: string;
}

const EVENTS = [
  { eventId: 1, eventName: "MS A R1/R5", discipline: "MS" },
  { eventId: 2, eventName: "WS A R1/R5", discipline: "WS" },
  { eventId: 3, eventName: "MS A R5/R9", discipline: "MS" },
  { eventId: 4, eventName: "WS A R5/R9", discipline: "WS" },
  { eventId: 5, eventName: "DM A R1/R5", discipline: "DM" },
];

// Tagesraster (heute): Startzeiten 09:00 / 10:30 / 12:00 / 14:30 / 16:00 /
// 18:00 / 19:30 über die Plätze 1–6 – füllt den Order-of-Play-Plan.
const MATCHES: SeedMatch[] = [
  // 09:00 – Vormittag, bereits gespielt (mit Resultat)
  { eventId: 2, eventName: "WS A R1/R5", key: "t:1", court: "Platz 1", time: "09:00", side1: ["Weiss Xenia (R5)"], side2: ["Rasetti Nadia (R5)"], result: "6:2 6:3" },
  { eventId: 3, eventName: "MS A R5/R9", key: "t:2", court: "Platz 2", time: "09:00", side1: ["Kalayci Cem (R7)"], side2: ["Issler Stefan (R7)"], result: "7:5 6:4" },
  { eventId: 1, eventName: "MS A R1/R5", key: "t:3", court: "Platz 3", time: "09:00", side1: ["Rauch Markus (R4)"], side2: ["Aepli Daniel (R4)"], result: "6:4 3:6 10:7" },
  { eventId: 4, eventName: "WS A R5/R9", key: "t:4", court: "Platz 4", time: "09:00", side1: ["Mellini Karin (R7)"], side2: ["Ganz Karin (R7)"], result: "6:1 4:6 10:8" },
  // 10:30
  { eventId: 1, eventName: "MS A R1/R5", key: "t:5", court: "Platz 1", time: "10:30", side1: ["Groenveld Quinten (R5)"], side2: ["Persico Christian (R3)"] },
  { eventId: 2, eventName: "WS A R1/R5", key: "t:6", court: "Platz 2", time: "10:30", side1: ["Roth Lorena (R5)"], side2: ["Schnuck Maria (R5)"] },
  { eventId: 3, eventName: "MS A R5/R9", key: "t:7", court: "Platz 3", time: "10:30", side1: ["Pedretti Christoph (R7)"], side2: ["Hofer Roli (R6)"] },
  { eventId: 5, eventName: "DM A R1/R5", key: "t:8", court: "Platz 4", time: "10:30", side1: ["Yuen Denis (R5)", "Rasetti Nadia (R5)"], side2: ["Kolbe Daniel (R8)", "Mellini Karin (R7)"] },
  { eventId: 4, eventName: "WS A R5/R9", key: "t:9", court: "Platz 5", time: "10:30", side1: ["Kucera Talissa (R5)"], side2: ["Kramer Sophia (R6)"] },
  { eventId: 1, eventName: "MS A R1/R5", key: "t:10", court: "Platz 6", time: "10:30", side1: ["Biella Andrea (R3)"], side2: ["Ruttmann Robert (R4)"] },
  // 12:00
  { eventId: 1, eventName: "MS A R1/R5", key: "t:11", court: "Platz 1", time: "12:00", side1: ["Franchini Gianluca (R2)"], side2: ["Rusconi Matteo (R3)"] },
  { eventId: 3, eventName: "MS A R5/R9", key: "t:12", court: "Platz 2", time: "12:00", side1: ["Siczek Tomasz (R9)"], side2: ["Wiederkehr Marius (R9)"] },
  { eventId: 2, eventName: "WS A R1/R5", key: "t:13", court: "Platz 3", time: "12:00", side1: ["Wüst Martina (R5)"], side2: ["Beck Claudia (R4)"] },
  // 14:30
  { eventId: 2, eventName: "WS A R1/R5", key: "t:14", court: "Platz 1", time: "14:30", side1: ["Bütikofer Anne (R5)"], side2: ["Weiss Xenia (R5)"] },
  { eventId: 4, eventName: "WS A R5/R9", key: "t:15", court: "Platz 2", time: "14:30", side1: ["Hansjosten Victoria (R8)"], side2: ["Jüngling Isabel (R8)"] },
  { eventId: 3, eventName: "MS A R5/R9", key: "t:16", court: "Platz 3", time: "14:30", side1: ["Kalayci Cem (R7)"], side2: ["Pedretti Christoph (R7)"] },
  // 16:00
  { eventId: 4, eventName: "WS A R5/R9", key: "t:17", court: "Platz 1", time: "16:00", side1: ["Mellini Karin (R7)"], side2: ["Hansjosten Victoria (R8)"] },
  { eventId: 5, eventName: "DM A R1/R5", key: "t:18", court: "Platz 2", time: "16:00", side1: ["Yuen Denis (R5)", "Bütikofer Anne (R5)"], side2: ["Persico Christian (R3)", "Ganz Karin (R7)"] },
  { eventId: 1, eventName: "MS A R1/R5", key: "t:19", court: "Platz 3", time: "16:00", side1: ["Aepli Daniel (R4)"], side2: ["Groenveld Quinten (R5)"] },
  // 18:00
  { eventId: 2, eventName: "WS A R1/R5", key: "t:20", court: "Platz 1", time: "18:00", side1: ["Beck Claudia (R4)"], side2: ["Kucera Talissa (R5)"] },
  { eventId: 3, eventName: "MS A R5/R9", key: "t:21", court: "Platz 2", time: "18:00", side1: ["Issler Stefan (R7)"], side2: ["Hofer Roli (R6)"] },
  { eventId: 4, eventName: "WS A R5/R9", key: "t:22", court: "Platz 3", time: "18:00", side1: ["Ganz Karin (R7)"], side2: ["Kramer Sophia (R6)"] },
  { eventId: 1, eventName: "MS A R1/R5", key: "t:23", court: "Platz 4", time: "18:00", side1: ["Franchini Gianluca (R2)"], side2: ["Biella Andrea (R3)"] },
  { eventId: 2, eventName: "WS A R1/R5", key: "t:24", court: "Platz 5", time: "18:00", side1: ["Wüst Martina (R5)"], side2: ["Roth Lorena (R5)"] },
  // 19:30 – Doppel (längere Zellen)
  { eventId: 5, eventName: "DM A R1/R5", key: "t:25", court: "Platz 1", time: "19:30", side1: ["Rauch Markus (R4)", "Weiss Xenia (R5)"], side2: ["Aepli Daniel (R4)", "Roth Lorena (R5)"] },
  { eventId: 5, eventName: "DM A R1/R5", key: "t:26", court: "Platz 3", time: "19:30", side1: ["Yuen Denis (R5)", "Rasetti Nadia (R5)"], side2: ["Kolbe Daniel (R8)", "Ganz Karin (R7)"] },
  // Noch offener Slot (leere Namen, wie „Sieger aus …") – darf nirgends erscheinen.
  { eventId: 1, eventName: "MS A R1/R5", key: "t:empty", court: "Platz 2", time: "20:30", side1: [""], side2: [""] },
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function scheduleDate(dayOffset: number): string {
  const at = new Date();
  at.setHours(0, 0, 0, 0);
  at.setDate(at.getDate() + dayOffset);
  return `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Variante eines Tages: dasselbe Zeit×Platz-Raster, aber die Matchups
 * (Kategorie + beide Seiten) werden zufällig auf die Positionen verteilt und
 * ohne Resultat angesetzt (Folgetage sind noch nicht gespielt). Damit sieht
 * jeder Tag anders aus.
 */
function variantForDay(base: SeedMatch[], day: number): SeedMatch[] {
  const matchups = shuffle(
    base.map((m) => ({ eventId: m.eventId, eventName: m.eventName, side1: m.side1, side2: m.side2 })),
  );
  return base.map((m, index) => ({
    key: `${m.key}:d${day}`,
    court: m.court,
    time: m.time,
    eventId: matchups[index]!.eventId,
    eventName: matchups[index]!.eventName,
    side1: matchups[index]!.side1,
    side2: matchups[index]!.side2,
  }));
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
    for (let day = 0; day <= EXTRA_DAYS; day++) {
    // Tag 0 = fester Tagesplan (mit Resultaten am Vormittag), Folgetage variiert.
    const dayMatches = day === 0 ? MATCHES : variantForDay(MATCHES, day);
    for (const match of dayMatches) {
      const date = scheduleDate(day);
      insertMatch.run({
        tid: TEST_TOURNAMENT_ID,
        tname: TEST_NAME,
        now,
        eventId: match.eventId,
        eventName: match.eventName,
        key: match.key,
        roundName: "Testrunde",
        date,
        time: match.time,
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
    }
  });
  run();
  database.close();

  const total = MATCHES.length * (EXTRA_DAYS + 1);
  console.log(
    `Testdaten angelegt: Turnier ${TEST_TOURNAMENT_ID} („${TEST_NAME}"), ${total} Matches über ${EXTRA_DAYS + 1} Tage.`,
  );
  console.log(`Für Spieler-Links vorher \`npm run backfill:player-registry\` ausführen.`);
  console.log(`Testen mit: WAIDCUP_TOURNAMENT_ID=${TEST_TOURNAMENT_ID} npm run dev:waidcup`);
}

main();
