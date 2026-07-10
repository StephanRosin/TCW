/**
 * Einmaliger Turnier-Refresh (für Tests und manuelle Aktualisierung).
 *
 * Lädt alle aktiven Turniere von Swisstennis und schreibt sie in die DB.
 * MyTennis-Linkauflösung ist per Default aus (schneller); mit `--with-links`
 * werden Spielerprofile aufgelöst.
 */
import { createTournamentService, loadConfig, openDatabase } from "@tcw/core";

const config = loadConfig();
const resolvePlayerUrls = process.argv.includes("--with-links");

async function main(): Promise<void> {
  const database = openDatabase({ filePath: config.dbFilePath });
  const service = createTournamentService(config, database);
  console.log(`Aktualisiere aktive Turniere (Linkauflösung: ${resolvePlayerUrls ? "an" : "aus"}) …`);
  const results = await service.refreshAllActive({ resolvePlayerUrls });
  for (const result of results) {
    console.log(
      `Turnier ${result.tournamentId}: ${result.events} Events, ${result.players} Anmeldungen, ${result.matches} Matches.`,
    );
  }
  database.close();
  console.log("Fertig.");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
