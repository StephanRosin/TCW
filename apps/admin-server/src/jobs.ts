/**
 * Hintergrund-Jobs des Admin-Prozesses: stündlicher ClubResult-Import der
 * Spieltermine und Turnier-Polling (mit Jitter, damit Swisstennis nicht mit
 * Request-Spitzen belastet wird). Fehler werden geloggt, alte Daten bleiben
 * bei Fehlern erhalten.
 */
import {
  createAgendaImporter,
  createMatchesImporter,
  createTournamentService,
  type AppConfig,
  type TcwDatabase,
} from "@tcw/core";
import type { FastifyBaseLogger } from "fastify";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const INITIAL_DELAY_MS = 5_000;
const MATCHES_JITTER_MS = 5 * 60 * 1000;
const TOURNAMENT_JITTER_MS = 10 * 60 * 1000;
const AGENDA_JITTER_MS = 15 * 60 * 1000;

function jitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs);
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
    HOUR_MS,
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

  logger.info("Hintergrund-Jobs gestartet (Spieltermine + Turniere stündlich, Agenda täglich).");
}
