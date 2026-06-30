/**
 * Öffentlicher Fastify-Server des TCW Spielbetriebs.
 *
 * Liefert die öffentliche API und – im Produktionsbetrieb – das gebaute
 * Frontend. Im lokalen Dev-Betrieb übernimmt der Vite-Server die UI und leitet
 * `/api`-Anfragen hierher weiter.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { loadConfig, openDatabase, PUBLIC_SECURITY_HEADERS, type AppConfig } from "@tcw/core";
import type { HealthResponse } from "@tcw/shared";
import { registerPublicCoreRoutes } from "./routes/public-api.js";
import { registerIcResultRoutes } from "./routes/ic-results.js";
import { registerWebcamRoute } from "./routes/webcam.js";
import { registerCourtsRoute } from "./routes/courts.js";

const WEB_DIST_DIR = resolve(loadConfig().repoRoot, "apps/web-public/dist");

export async function buildPublicApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const database = openDatabase({ filePath: config.dbFilePath, readonly: true });

  // Begrenzt u. a. die Verstärkung externer Swisstennis-Abrufe pro Client.
  // Muss vor den Routen geladen sein, damit der globale Hook greift.
  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.addHook("onSend", async (_request, reply, payload) => {
    for (const [header, value] of Object.entries(PUBLIC_SECURITY_HEADERS)) {
      reply.header(header, value);
    }
    return payload;
  });

  // Client-Fehler (z. B. Rate-Limit 429) durchreichen, Serverfehler ohne
  // interne Details (Integrations-URLs etc.) abfangen.
  app.setErrorHandler((error: { statusCode?: number }, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply.code(status).send({ error: status === 429 ? "Zu viele Anfragen." : "Ungültige Anfrage." });
    }
    request.log.error(error);
    return reply.code(500).send({ error: "Interner Serverfehler" });
  });

  app.addHook("onClose", async () => {
    database.close();
  });

  app.get("/api/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "public",
    time: new Date().toISOString(),
  }));

  registerPublicCoreRoutes(app, database);
  registerIcResultRoutes(app, config);
  registerWebcamRoute(app);
  registerCourtsRoute(app, config);

  if (existsSync(WEB_DIST_DIR)) {
    app.register(fastifyStatic, { root: WEB_DIST_DIR });
  }
  // Hash-Routing: Es gibt keine Server-Routen außer "/" und den Assets.
  // Unbekannte Pfade (DB, Skripte, Logs) liefern strikt 404 – keine SPA-Fallback-
  // Auslieferung, damit keine internen Dateien erreichbar sind.
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not Found" });
  });

  return app;
}
