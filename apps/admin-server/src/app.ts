/**
 * Interner Admin-Fastify-Server des TCW Spielbetriebs.
 *
 * Pflegt alle nicht direkt aus Swisstennis stammenden Daten und steuert
 * Importe/Polling. Läuft LAN-intern (Default-Bind 127.0.0.1) und hat
 * Schreibzugriff auf die Datenbank.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import {
  ADMIN_SECURITY_HEADERS,
  ConflictError,
  createAgendaImporter,
  createMatchesImporter,
  createTournamentService,
  loadConfig,
  openDatabase,
  ValidationError,
  type AppConfig,
} from "@tcw/core";
import type { HealthResponse } from "@tcw/shared";
import { registerAdminRoutes } from "./routes/admin-api.js";
import { registerAdminAuth } from "./auth.js";
import { startBackgroundJobs } from "./jobs.js";

const WEB_DIST_DIR = resolve(loadConfig().repoRoot, "apps/web-admin/dist");

export async function buildAdminApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
  const database = openDatabase({ filePath: config.dbFilePath, readonly: false });
  const tournamentService = createTournamentService(config, database);
  const matchesImporter = createMatchesImporter(config, database);
  const agendaImporter = createAgendaImporter(config, database);

  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });
  registerAdminAuth(app, config);

  app.addHook("onSend", async (_request, reply, payload) => {
    for (const [header, value] of Object.entries(ADMIN_SECURITY_HEADERS)) {
      reply.header(header, value);
    }
    return payload;
  });

  app.addHook("onClose", async () => {
    database.close();
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ValidationError) {
      return reply.code(400).send({ error: error.message });
    }
    if (error instanceof ConflictError) {
      return reply.code(409).send({ error: error.message });
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: status === 429 ? "Zu viele Anfragen." : "Ungültige Anfrage." });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Interner Serverfehler" });
  });

  app.get("/api/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "admin",
    time: new Date().toISOString(),
  }));

  registerAdminRoutes(app, { database, config, tournamentService, matchesImporter, agendaImporter });

  startBackgroundJobs(config, database, app.log);

  if (existsSync(WEB_DIST_DIR)) {
    app.register(fastifyStatic, { root: WEB_DIST_DIR });
  }
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not Found" });
  });

  return app;
}
