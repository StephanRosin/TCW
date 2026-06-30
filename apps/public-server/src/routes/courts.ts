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

export function registerCourtsRoute(app: FastifyInstance, config: AppConfig): void {
  const service = new GotCourtsService(credentialsFrom(config));
  app.get<{ Querystring: { at?: string } }>("/api/courts", async (request) => {
    return service.getOccupancy(request.query.at);
  });
}
