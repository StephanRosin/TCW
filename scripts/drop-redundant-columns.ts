/**
 * Einmalige Migration: entfernt die redundanten Spalten, deren Werte jetzt zentral im
 * player_registry liegen. Idempotent (prüft PRAGMA table_info vor dem Drop).
 *   npm run migrate:drop-redundant
 * VORHER Backup ziehen (siehe data/ic_teams.rollback-pre-phase3-*).
 */
import { loadConfig, openDatabase } from "@tcw/core";

const DROPS: Array<[string, string]> = [
  ["players", "klassierung"],
  ["players", "myTennisID"],
  ["tournament_players", "ranking"],
  ["tournament_players", "ranking_2"],
];

const config = loadConfig();
const db = openDatabase({ filePath: config.dbFilePath });
let dropped = 0;
for (const [table, column] of DROPS) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
  if (cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    console.log(`  ${table}.${column} entfernt.`);
    dropped += 1;
  } else {
    console.log(`  ${table}.${column} bereits weg — übersprungen.`);
  }
}
db.close();
console.log(`Fertig: ${dropped} Spalte(n) entfernt.`);
