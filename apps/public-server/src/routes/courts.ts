/**
 * Öffentliche Route für die Platzbelegung (GotCourts).
 *
 * Ein optionaler `at`-Parameter (ISO, z. B. 2026-07-01T19:30) verschiebt den
 * Bezugszeitpunkt – nützlich zum Testen; das Datum wird serverseitig auf einen
 * engen Bereich begrenzt.
 */
import type { FastifyInstance } from "fastify";
import { GotCourtsService, type AppConfig, type GotCourtsCredentials } from "@tcw/core";

function credentialsFrom(config: AppConfig): GotCourtsCredentials | null {
  if (config.gotcourtsEmail === "" || config.gotcourtsPassword === "") {
    return null;
  }
  return {
    email: config.gotcourtsEmail,
    password: config.gotcourtsPassword,
    clubId: config.gotcourtsClubId,
    timeoutMs: config.gotcourtsTimeoutMs,
  };
}

/** Millisekunden bis zur nächsten Minute :59 (Sekunde 0). */
function msUntilNext59(now: Date): number {
  const next = new Date(now);
  next.setMinutes(59, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setTime(next.getTime() + 60 * 60 * 1000);
  }
  return next.getTime() - now.getTime();
}

/** Erneuert die Belegung stündlich um :59, damit zum Stundenwechsel frische Daten anliegen. */
function scheduleHourlyRefresh(app: FastifyInstance, service: GotCourtsService): void {
  let timer: NodeJS.Timeout | undefined;
  const runAndReschedule = (): void => {
    service.refreshToday().catch((error) => app.log.warn({ error }, "GotCourts-Refresh fehlgeschlagen"));
    schedule();
  };
  const schedule = (): void => {
    timer = setTimeout(runAndReschedule, msUntilNext59(new Date()));
    timer.unref();
  };
  schedule();
  app.addHook("onClose", async () => {
    if (timer) clearTimeout(timer);
  });
}

export function registerCourtsRoute(app: FastifyInstance, config: AppConfig): void {
  const service = new GotCourtsService(credentialsFrom(config));
  app.get<{ Querystring: { at?: string } }>("/api/courts", async (request) => {
    return service.getOccupancy(request.query.at);
  });
  if (service.configured) {
    // Beim Start einmal vorwärmen, danach stündlich um :59 erneuern.
    service.refreshToday().catch((error) => app.log.warn({ error }, "GotCourts-Vorabladen fehlgeschlagen"));
    scheduleHourlyRefresh(app, service);
  }
}
