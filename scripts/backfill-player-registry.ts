/**
 * Backfill des Spieler-Registers aus den Bestandstabellen (einmalig, idempotent):
 *   npm run backfill:player-registry
 */
import { backfillPlayerRegistry, loadConfig, openDatabase } from "@tcw/core";

const config = loadConfig();
const db = openDatabase({ filePath: config.dbFilePath });
const { total } = backfillPlayerRegistry(db);
db.close();
console.log(`Spieler-Register befüllt: ${total} Einträge.`);
