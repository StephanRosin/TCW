/**
 * Überträgt die bestätigten Spieltermine aus der CM-Platz-App (cm.db) auf die
 * offenen Clubmeisterschafts-Partien: Datum/Uhrzeit/Platz in `tournament_matches`
 * (Matchliste + Round-robin) und im `bracket_json` (Tableau).
 *
 * Manueller Trigger für dieselbe Logik, die der admin-server nach jedem
 * Swisstennis-Import ausführt. Braucht `CM_PLATZ_DB_PATH` (Pfad zur cm.db);
 * ohne diesen passiert nichts.
 */
import { applyCmReservationDates, loadConfig, openDatabase } from "@tcw/core";

const config = loadConfig();

function main(): void {
  if (config.cmPlatzDbPath.trim() === "") {
    console.error("CM_PLATZ_DB_PATH ist nicht gesetzt – keine CM-Termine zu übernehmen.");
    process.exit(1);
  }
  const database = openDatabase({ filePath: config.dbFilePath });
  console.log(`CM-Termine aus ${config.cmPlatzDbPath} übernehmen …`);
  const result = applyCmReservationDates(database, config.cmPlatzDbPath);
  console.log(
    `${result.reservations} bestätigte Reservationen: ${result.matchesUpdated} Matches, ` +
      `${result.bracketNodesUpdated} Tableau-Knoten aktualisiert.`,
  );
  database.close();
  console.log("Fertig.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
