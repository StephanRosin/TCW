/**
 * Einmaliger Turnier-Refresh (für Tests und manuelle Aktualisierung).
 *
 * Lädt alle aktiven Turniere von Swisstennis und schreibt sie in die DB.
 * MyTennis-Linkauflösung ist per Default aus (schneller); mit `--with-links`
 * werden Spielerprofile aufgelöst.
 *
 * Durchgespielte Turniere werden normalerweise übersprungen (siehe
 * `isTournamentSettled`). Mit `--tournament <id>` lässt sich eines gezielt
 * trotzdem holen — nötig, wenn sich am Import etwas geändert hat und die
 * bestehenden Daten nachgezogen werden müssen.
 */
import {
  createTournamentService,
  loadConfig,
  openDatabase,
  readTournamentConfigs,
} from "@tcw/core";

const config = loadConfig();
const resolvePlayerUrls = process.argv.includes("--with-links");

/** Turnier-IDs hinter `--tournament`, mehrfach erlaubt. */
function requestedIds(): number[] {
  const ids: number[] = [];
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] !== "--tournament") continue;
    const id = Number(process.argv[i + 1]);
    if (Number.isFinite(id)) ids.push(id);
  }
  return ids;
}

async function main(): Promise<void> {
  const database = openDatabase({ filePath: config.dbFilePath });
  const service = createTournamentService(config, database);
  const ids = requestedIds();
  const links = resolvePlayerUrls ? "an" : "aus";
  let results;
  if (ids.length > 0) {
    // Gezielt und ohne Rücksicht auf den Abschluss des Turniers.
    const configs = readTournamentConfigs(database, true).filter((entry) =>
      ids.includes(entry.swisstennisTournamentId),
    );
    const fehlend = ids.filter((id) => !configs.some((entry) => entry.swisstennisTournamentId === id));
    if (fehlend.length > 0) {
      console.warn(`Nicht als aktives Turnier bekannt, übersprungen: ${fehlend.join(", ")}`);
    }
    console.log(`Erzwinge Aktualisierung von ${configs.length} Turnier(en) (Linkauflösung: ${links}) …`);
    results = [];
    for (const entry of configs) {
      results.push(await service.refresh(entry, { resolvePlayerUrls }));
    }
  } else {
    console.log(`Aktualisiere aktive Turniere (Linkauflösung: ${links}) …`);
    results = await service.refreshAllActive({ resolvePlayerUrls });
  }
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
