import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../db/connection.js";
import { upsertPlayer } from "./player-registry.js";
import { getRankingChanges } from "./ranking-service.js";

const URL_MEMBER = "https://www.mytennis.ch/de/spieler/111";
const URL_GUEST = "https://www.mytennis.ch/de/spieler/222";

function seed(db: ReturnType<typeof openDatabase>): void {
  upsertPlayer(db, { name: "Anna Mitglied", url: URL_MEMBER, klassierung: "R4", member: true, memberSource: "roster" });
  upsertPlayer(db, { name: "Extern Gast", url: URL_GUEST, klassierung: "R4" }); // Nicht-Mitglied
  const ins = db.prepare(
    `INSERT INTO ranking_changes (player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  // A: TCW-Mitglied, echte Änderung → soll erscheinen
  ins.run(1, "Anna Mitglied", URL_MEMBER, "R5", "R4", "2026-07-04T10:00:00.000Z");
  // B: TCW-Mitglied, aber Ersterfassung (leere alte Klassierung) → gefiltert
  ins.run(1, "Anna Mitglied", URL_MEMBER, "", "R4", "2026-07-04T10:01:00.000Z");
  // C: Nicht-Mitglied, echte Änderung → gefiltert
  ins.run(2, "Extern Gast", URL_GUEST, "R5", "R4", "2026-07-04T10:02:00.000Z");
}

test("getRankingChanges: nur TCW-Mitglieder mit echter Änderung (alte Klassierung nicht leer)", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db);
  const { items } = getRankingChanges(db);
  assert.equal(items.length, 1, "nur die eine echte Mitglieder-Änderung");
  assert.equal(items[0]!.playerName, "Anna Mitglied");
  assert.equal(items[0]!.oldKlassierung, "R5");
  assert.equal(items[0]!.newKlassierung, "R4");
  db.close();
});

test("getRankingChanges: Nicht-Mitglieder und Ersterfassungen werden ausgeblendet", () => {
  const db = openDatabase({ filePath: ":memory:" });
  seed(db);
  const { items } = getRankingChanges(db);
  assert.ok(!items.some((i) => i.playerName === "Extern Gast"), "kein Nicht-Mitglied");
  assert.ok(!items.some((i) => i.oldKlassierung === ""), "keine Ersterfassung (leere alte Klassierung)");
  db.close();
});

test("getRankingChanges: zeigt nur den letzten Lauf, ältere Runden fallen weg", () => {
  const db = openDatabase({ filePath: ":memory:" });
  upsertPlayer(db, { name: "Anna Mitglied", url: URL_MEMBER, klassierung: "R4", member: true, memberSource: "roster" });
  const ins = db.prepare(
    `INSERT INTO ranking_changes (player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at)
     VALUES (1, 'Anna Mitglied', ?, ?, ?, ?)`,
  );
  ins.run(URL_MEMBER, "R5", "R4", "2026-04-01 10:00:00");
  ins.run(URL_MEMBER, "R4", "R3", "2026-10-07 06:30:00");
  const { items } = getRankingChanges(db);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.oldKlassierung, "R4");
  assert.equal(items[0]!.newKlassierung, "R3");
  db.close();
});

test("getRankingChanges: Name kommt aus dem Kader, nicht aus dem Importnamen", () => {
  const db = openDatabase({ filePath: ":memory:" });
  const regId = upsertPlayer(db, { name: "Anna Mitglied", url: URL_MEMBER, member: true, memberSource: "roster" });
  db.prepare("INSERT INTO teams (gender, category, liga) VALUES ('Damen', 'Aktive', 'NLA')").run();
  db.prepare("INSERT INTO players (team_id, name, registry_id) VALUES (1, 'Anna Mitglied', ?)").run(regId);
  db.prepare(
    `INSERT INTO ranking_changes (player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at)
     VALUES (?, 'Mitglied Anna (R5)', ?, 'R5', 'R4', '2026-10-07 06:30:00')`,
  ).run(regId, URL_MEMBER);
  const { items } = getRankingChanges(db);
  assert.equal(items[0]!.playerName, "Anna Mitglied");
  db.close();
});

test("getRankingChanges: ohne Kadereintrag wird der Klassierungszusatz entfernt", () => {
  const db = openDatabase({ filePath: ":memory:" });
  upsertPlayer(db, { name: "Anna Mitglied", url: URL_MEMBER, member: true, memberSource: "admin" });
  db.prepare(
    `INSERT INTO ranking_changes (player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at)
     VALUES (1, 'Mitglied Anna (R5)', ?, 'R5', 'R4', '2026-10-07 06:30:00')`,
  ).run(URL_MEMBER);
  const { items } = getRankingChanges(db);
  assert.equal(items[0]!.playerName, "Mitglied Anna");
  db.close();
});
