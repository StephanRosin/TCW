/**
 * Hintergrund-Jobs des Admin-Prozesses: stündlicher ClubResult-Import der
 * Spieltermine und Turnier-Polling (mit Jitter, damit Swisstennis nicht mit
 * Request-Spitzen belastet wird). Fehler werden geloggt, alte Daten bleiben
 * bei Fehlern erhalten.
 *
 * Zur Schonung der Swisstennis-API laufen die Swisstennis-Jobs nur tagsüber
 * (Nachtruhe 23–09 Uhr); der Interclub-Import läuft zudem nur in der Saison
 * (Mai–Juni). Die Agenda (kein Swisstennis) ist davon ausgenommen.
 */
import {
  createAgendaImporter,
  createMatchesImporter,
  createTournamentService,
  syncPlayerMatches,
  type AppConfig,
  type TcwDatabase,
} from "@tcw/core";
import type { FastifyBaseLogger } from "fastify";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Turniere alle 30 Minuten: hält Waidcup-Live-Board und Resultate aktuell.
const TOURNAMENT_INTERVAL_MS = 30 * 60 * 1000;
const INITIAL_DELAY_MS = 5_000;
const MATCHES_JITTER_MS = 5 * 60 * 1000;
const TOURNAMENT_JITTER_MS = 10 * 60 * 1000;
const AGENDA_JITTER_MS = 15 * 60 * 1000;
const PLAYER_MATCHES_JITTER_MS = 8 * 60 * 1000;

// Nachtruhe: zwischen 23:00 und 09:00 (Serverzeit = CH-Zeit) keine
// Swisstennis-Abrufe – spart Calls und Laufzeit, wenn ohnehin niemand spielt.
const QUIET_START_HOUR = 23;
const QUIET_END_HOUR = 9;
// Interclub-Saison: Mai + Juni. Ausserhalb wird IC nicht mehr abgerufen
// (Saison vorbei, Daten ändern sich nicht mehr).
const INTERCLUB_MONTHS = [4, 5]; // 0 = Januar

function jitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs);
}

function isQuietHour(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

function isInterclubSeason(date = new Date()): boolean {
  return INTERCLUB_MONTHS.includes(date.getMonth());
}

function scheduleRecurring(task: () => Promise<void>, intervalMs: number, jitterMs: number): void {
  const run = (): void => {
    task().finally(() => {
      setTimeout(run, intervalMs + jitter(jitterMs)).unref();
    });
  };
  setTimeout(run, INITIAL_DELAY_MS + jitter(jitterMs)).unref();
}

export function startBackgroundJobs(
  config: AppConfig,
  database: TcwDatabase,
  logger: FastifyBaseLogger,
): void {
  if (!config.enableBackgroundJobs) {
    logger.info("Hintergrund-Jobs sind deaktiviert (IC_ENABLE_JOBS=false).");
    return;
  }

  const matchesImporter = createMatchesImporter(config, database);
  const tournamentService = createTournamentService(config, database);
  const agendaImporter = createAgendaImporter(config, database);

  scheduleRecurring(
    async () => {
      if (isQuietHour()) return;
      if (!isInterclubSeason()) return; // Interclub nur Mai–Juni abrufen
      try {
        const count = await matchesImporter.importMatches();
        logger.info(`Spieltermine importiert: ${count} Einträge.`);
      } catch (error) {
        logger.error({ error }, "Spieltermin-Import fehlgeschlagen – bestehende Daten bleiben erhalten.");
      }
    },
    HOUR_MS,
    MATCHES_JITTER_MS,
  );

  scheduleRecurring(
    async () => {
      if (isQuietHour()) return;
      try {
        const results = await tournamentService.refreshAllActive({
          resolvePlayerUrls: config.resolvePlayerUrls,
        });
        const total = results.reduce((sum, result) => sum + result.matches, 0);
        logger.info(`Turniere aktualisiert: ${results.length} Turniere, ${total} Matches.`);
      } catch (error) {
        logger.error({ error }, "Turnier-Polling fehlgeschlagen – bestehende Daten bleiben erhalten.");
      }
    },
    TOURNAMENT_INTERVAL_MS,
    TOURNAMENT_JITTER_MS,
  );

  scheduleRecurring(
    async () => {
      try {
        const count = await agendaImporter.importAgenda();
        logger.info(`Agenda importiert: ${count} Events.`);
      } catch (error) {
        logger.error({ error }, "Agenda-Import fehlgeschlagen – bestehende Daten bleiben erhalten.");
      }
    },
    DAY_MS,
    AGENDA_JITTER_MS,
  );

  // Spielermatches inkrementell: nur neue/geänderte Begegnungen, gedeckelt und
  // mit 4s Pause zwischen Abrufen, damit Swisstennis nicht belastet wird.
  scheduleRecurring(
    async () => {
      if (isQuietHour()) return;
      try {
        await syncPlayerMatches(database, config, {
          delayMs: 4_000,
          maxEncounters: 20,
          maxUrlLookups: 25,
          resolveUrls: true,
          log: (message) => logger.debug(message),
        });
        logger.info("Spielermatches synchronisiert.");
      } catch (error) {
        logger.error({ error }, "Spielermatches-Sync fehlgeschlagen – bestehende Daten bleiben erhalten.");
      }
    },
    HOUR_MS,
    PLAYER_MATCHES_JITTER_MS,
  );

  logger.info(
    "Hintergrund-Jobs gestartet (Spieltermine + Turniere + Spielermatches stündlich, Agenda täglich; " +
      "Swisstennis-Jobs pausieren 23–09 Uhr, Interclub nur Mai–Juni).",
  );
}
