import assert from "node:assert/strict";
import { test } from "node:test";
import { playerNameKey, type TournamentMatchStatus } from "@tcw/shared";
import { openDatabase, type TcwDatabase } from "../db/connection.js";
import { loadTournamentEvents, replaceTournamentData, type EventImport } from "./tournament-store.js";

function registration(playerKey: string, note: string | null) {
  return {
    playerKey,
    playerName: `Player ${playerKey}`,
    playerName2: null,
    firstName: "Player",
    lastName: playerKey,
    firstName2: "",
    lastName2: "",
    licenseNumber: null,
    licenseNumber2: null,
    confirmed: 1,
    ranking: "R5",
    ranking2: null,
    registeredOn: "01.05.2026",
    registeredOnSort: "2026-05-01T00:00:00",
    note,
    sortOrder: 0,
    playerUrl: "",
    playerUrl2: "",
  };
}

test("replaceTournamentData spiegelt Spieler ins Register (non-member, mit URL)", () => {
  const database = openDatabase({ filePath: ":memory:" });
  const events: EventImport[] = [
    {
      meta: { eventId: 1, eventName: "MS", discipline: "MS", mode: "Draw", matchTypeId: 1, sortOrder: 1 },
      registrations: [
        {
          playerKey: "k1",
          playerName: "Till Novak",
          playerName2: null,
          firstName: "Till",
          lastName: "Novak",
          firstName2: "",
          lastName2: "",
          licenseNumber: "1",
          licenseNumber2: null,
          confirmed: 1,
          ranking: "R4",
          ranking2: null,
          registeredOn: "",
          registeredOnSort: "",
          note: null,
          sortOrder: 0,
          playerUrl: "https://www.mytennis.ch/de/spieler/19799660",
          playerUrl2: "",
        },
      ],
      matches: [],
      pools: [],
      bracket: null,
    },
  ];

  replaceTournamentData(database, 158138, "Waidcup", events, new Date().toISOString());

  const nameKey = playerNameKey("Till Novak");
  const row = database
    .prepare("SELECT profile_url, is_tcw_member FROM player_registry WHERE name_key = ?")
    .get(nameKey) as { profile_url: string; is_tcw_member: number } | undefined;
  assert.equal(row?.profile_url, "https://www.mytennis.ch/de/spieler/19799660");
  assert.equal(row?.is_tcw_member, 0);
  database.close();
});

test("Turnier-Import setzt tournament_players.registry_id (weicher Link)", () => {
  const database = openDatabase({ filePath: ":memory:" });
  const events: EventImport[] = [
    {
      meta: { eventId: 1, eventName: "MS", discipline: "MS", mode: "Draw", matchTypeId: 1, sortOrder: 1 },
      registrations: [
        {
          playerKey: "k1",
          playerName: "Till Novak",
          playerName2: null,
          firstName: "Till",
          lastName: "Novak",
          firstName2: "",
          lastName2: "",
          licenseNumber: "1",
          licenseNumber2: null,
          confirmed: 1,
          ranking: "R4",
          ranking2: null,
          registeredOn: "",
          registeredOnSort: "",
          note: null,
          sortOrder: 0,
          playerUrl: "https://www.mytennis.ch/de/spieler/19799660",
          playerUrl2: "",
        },
      ],
      matches: [],
      pools: [],
      bracket: null,
    },
  ];

  replaceTournamentData(database, 158138, "Waidcup", events, new Date().toISOString());

  const row = database
    .prepare(
      "SELECT tp.registry_id, r.profile_url FROM tournament_players tp JOIN player_registry r ON r.id = tp.registry_id",
    )
    .get() as { registry_id: number; profile_url: string } | undefined;
  assert.ok(row && row.registry_id > 0);
  assert.equal(row.profile_url, "https://www.mytennis.ch/de/spieler/19799660");
  database.close();
});

test("loadTournamentEvents liest ranking aus dem Register (aktuell), nicht aus dem Import-Snapshot", () => {
  const database = openDatabase({ filePath: ":memory:" });
  const events: EventImport[] = [
    {
      meta: { eventId: 1, eventName: "MS", discipline: "MS", mode: "Draw", matchTypeId: 1, sortOrder: 1 },
      registrations: [
        {
          playerKey: "k1",
          playerName: "Till Novak",
          playerName2: null,
          firstName: "Till",
          lastName: "Novak",
          firstName2: "",
          lastName2: "",
          licenseNumber: "1",
          licenseNumber2: null,
          confirmed: 1,
          ranking: "R1",
          ranking2: null,
          registeredOn: "",
          registeredOnSort: "",
          note: null,
          sortOrder: 0,
          playerUrl: "https://www.mytennis.ch/de/spieler/19799660",
          playerUrl2: "",
        },
      ],
      matches: [],
      pools: [],
      bracket: null,
    },
  ];

  // Import spiegelt "R1" als Snapshot in tournament_players.ranking und ins Register.
  replaceTournamentData(database, 158138, "Waidcup", events, new Date().toISOString());

  // Das Register wird danach unabhängig aktualisiert (z. B. durch einen CM-Import) –
  // die aktuelle Klassierung weicht jetzt vom Turnier-Snapshot ab.
  database
    .prepare("UPDATE player_registry SET klassierung = 'R7' WHERE name_key = ?")
    .run(playerNameKey("Till Novak"));

  const snapshotRow = database
    .prepare("SELECT ranking FROM tournament_players WHERE tournament_id = 158138 AND player_key = 'k1'")
    .get() as { ranking: string } | undefined;
  assert.equal(snapshotRow?.ranking, "R1", "Snapshot in tournament_players bleibt unverändert");

  const { events: loadedEvents } = loadTournamentEvents(database, 158138);
  const player = loadedEvents[0]?.players.find((p) => p.playerKey === "k1");
  assert.ok(player, "Registrierung muss trotz LEFT JOIN erhalten bleiben");
  assert.equal(player!.ranking, "R7", "ranking muss aus dem Register (aktuell) kommen, nicht aus dem Snapshot");

  database.close();
});

test("replaceTournamentData speichert auch Spieler ohne Notiz (kein OR-IGNORE-Verlust)", () => {
  const database = openDatabase({ filePath: ":memory:" });
  const events: EventImport[] = [
    {
      meta: { eventId: 1, eventName: "WS A R1/R5", discipline: "WS", mode: "Draw", matchTypeId: 2, sortOrder: 0 },
      registrations: [registration("a", null), registration("b", "Kommentar"), registration("c", null)],
      matches: [],
      pools: [],
      bracket: null,
    },
  ];

  replaceTournamentData(database, 158138, "Waidcup", events, "2026-06-26T00:00:00Z");

  const count = database
    .prepare("SELECT COUNT(*) AS total FROM tournament_players WHERE tournament_id = 158138")
    .get() as { total: number };
  assert.equal(count.total, 3);
  database.close();
});

const CM = 158133;

function eventWith(result: string): EventImport {
  return {
    meta: { eventId: 100, eventName: "WS 40+", discipline: "WS", mode: "rr", matchTypeId: 0, sortOrder: 0 },
    registrations: [],
    matches: [
      {
        matchKey: "rr:100:1",
        eventId: 100,
        eventName: "WS 40+",
        mode: "rr",
        poolName: "Gruppe A",
        roundName: "",
        scheduledDate: "",
        scheduledTime: "",
        court: "",
        player1Name: "A. Spieler",
        player1Name2: "",
        player2Name: "B. Gegner",
        player2Name2: "",
        result,
        status: (result === "" ? "open" : "played") as TournamentMatchStatus,
        winnerSide: result === "" ? 0 : 1,
      },
    ],
    pools: [],
    bracket: null,
  };
}

function seenOf(db: TcwDatabase): string | null {
  const row = db.prepare("SELECT result_seen_at AS s FROM tournament_matches WHERE match_key='rr:100:1'").get() as
    | { s: string | null }
    | undefined;
  return row?.s ?? null;
}
function updatedOf(db: TcwDatabase): string {
  return (db.prepare("SELECT updated_at AS u FROM tournament_matches WHERE match_key='rr:100:1'").get() as { u: string }).u;
}

test("result_seen_at: leer→Ergebnis stempelt den Zeitpunkt, danach unverändert", () => {
  const db = openDatabase({ filePath: ":memory:" });
  replaceTournamentData(db, CM, "Clubmeisterschaft", [eventWith("")], "2026-06-30T10:00:00.000Z");
  assert.equal(seenOf(db), null);

  replaceTournamentData(db, CM, "Clubmeisterschaft", [eventWith("6:4 6:2")], "2026-07-01T18:00:00.000Z");
  assert.equal(seenOf(db), "2026-07-01T18:00:00.000Z");
  const firstUpdated = updatedOf(db);

  // Gleicher Stand, späterer Import → nichts geschrieben (updated_at + seen bleiben).
  replaceTournamentData(db, CM, "Clubmeisterschaft", [eventWith("6:4 6:2")], "2026-07-02T18:00:00.000Z");
  assert.equal(seenOf(db), "2026-07-01T18:00:00.000Z");
  assert.equal(updatedOf(db), firstUpdated);
  db.close();
});

test("result_seen_at: vorbestehendes Ergebnis (Altbestand) bekommt kein erfundenes Datum", () => {
  const db = openDatabase({ filePath: ":memory:" });
  db.exec(
    "INSERT INTO tournament_matches (tournament_id,event_id,match_key,tournament_name,event_name,mode,pool_name,round_name,scheduled_date,scheduled_time,court,player1_name,player1_name_2,player2_name,player2_name_2,result,status,winner_side,sort_order,updated_at,result_seen_at) " +
      "VALUES (158133,100,'rr:100:1','Clubmeisterschaft','WS 40+','rr','Gruppe A','','','','','A. Spieler','','B. Gegner','','6:4 6:2','played',1,0,'x',NULL)",
  );
  replaceTournamentData(db, CM, "Clubmeisterschaft", [eventWith("6:4 6:2")], "2026-07-05T18:00:00.000Z");
  assert.equal(seenOf(db), null);
  db.close();
});
