/**
 * Sofort-Refresh des „Order of Play" (heute + morgen) für das Waidcup-Turnier.
 *
 * Holt frisch von Swisstennis – am regulären 30-Minuten-Cache vorbei – und
 * aktualisiert NUR die heute/morgen terminierten Matches (Termin, Uhrzeit,
 * Platz, Ergebnis, Gewinner). Alles andere (übrige Tage, Anmeldungen, Tableaux)
 * bleibt unberührt. Gedacht für kurzfristige Änderungen, ohne auf den nächsten
 * regulären Import zu warten. Später löst der Refresh-Button in der Aufgaben-App
 * (Schritt 2) genau diese Logik aus.
 */
import {
  loadConfig,
  openDatabase,
  readTournamentConfigs,
  refreshOrderOfPlay,
  type TournamentConfig,
} from "@tcw/core";

const config = loadConfig();

async function main(): Promise<void> {
  const database = openDatabase({ filePath: config.dbFilePath });
  const configs = readTournamentConfigs(database, false);
  const tournamentConfig: TournamentConfig = configs.find(
    (candidate) => candidate.swisstennisTournamentId === config.waidcupTournamentId,
  ) ?? {
    id: 0,
    name: "Waidcup",
    swisstennisTournamentId: config.waidcupTournamentId,
    registrationUrl: "",
    active: true,
    sortOrder: 0,
  };

  console.log(`Order-of-Play-Refresh (Turnier ${tournamentConfig.swisstennisTournamentId}), frischer Abruf …`);
  const result = await refreshOrderOfPlay(config, database, tournamentConfig);
  console.log(
    `Tage ${result.dates.join(" + ")}: ${result.matchesScoped} terminierte Matches abgeglichen, ${result.written} aktualisiert; ${result.extrasUpdated} Tableaux/Pools aktualisiert.`,
  );
  database.close();
  console.log("Fertig.");
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
