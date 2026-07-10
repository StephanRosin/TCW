/**
 * Initialer/voller Backfill der Spielermatches (aktuelles Jahr).
 *
 * Läuft die Logik des Hintergrund-Jobs ohne Deckelung über ALLE Begegnungen,
 * mit Pause zwischen den Swisstennis-Abrufen (Default 4s). Danach lädt der
 * stündliche Job nur noch neue/geänderte Begegnungen nach.
 *
 *   npm run backfill:player-matches            # 4s Pause
 *   npm run backfill:player-matches -- --delay 5000 --force
 *   npm run backfill:player-matches -- --no-urls   # ohne Gegner-Linkauflösung
 */
import { loadConfig, openDatabase, syncPlayerMatches } from "@tcw/core";

const config = loadConfig();

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

async function main(): Promise<void> {
  const database = openDatabase({ filePath: config.dbFilePath });
  const delayMs = argValue("--delay", 4000);
  const force = process.argv.includes("--force");
  const resolveUrls = !process.argv.includes("--no-urls");
  const maxEncounters = argValue("--max", Number.POSITIVE_INFINITY);
  const maxUrlLookups = argValue("--max-urls", Number.POSITIVE_INFINITY);
  console.log(`Backfill Spielermatches (delay ${delayMs}ms, force=${force}, urls=${resolveUrls}) …`);
  await syncPlayerMatches(database, config, {
    delayMs,
    force,
    resolveUrls,
    maxEncounters,
    maxUrlLookups,
    log: (message) => console.log(message),
  });
  database.close();
  console.log("Backfill fertig.");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
