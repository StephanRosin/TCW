/**
 * Waidcup-Server: eigenständige, rein lesende Website für das Waidcup-Turnier.
 *
 * Liest dieselbe SQLite-Datenbank wie der Spielbetriebs-Server (read-only, der
 * Turnier-Import läuft weiterhin im Admin-Prozess) und liefert die API sowie
 * – im Produktionsbetrieb – das gebaute Waidcup-Frontend aus.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import {
  getWaidcupBrackets,
  getWaidcupLive,
  getWaidcupMatches,
  getWebcamFrame,
  loadConfig,
  openDatabase,
  PUBLIC_SECURITY_HEADERS,
  SERVER_LOGGER_OPTIONS,
  type AppConfig,
} from "@tcw/core";
import type { HealthResponse } from "@tcw/shared";

const WEB_DIST_DIR = resolve(loadConfig().repoRoot, "apps/waidcup-public/dist");

export async function buildWaidcupApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({ logger: { ...SERVER_LOGGER_OPTIONS } });
  const database = openDatabase({ filePath: config.dbFilePath, readonly: true });
  const tournamentId = config.waidcupTournamentId;

  await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

  app.addHook("onSend", async (_request, reply, payload) => {
    for (const [header, value] of Object.entries(PUBLIC_SECURITY_HEADERS)) {
      reply.header(header, value);
    }
    return payload;
  });

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
    service: "waidcup",
    time: new Date().toISOString(),
  }));

  app.get("/api/waidcup/brackets", async () => ({ events: getWaidcupBrackets(database, tournamentId) }));
  app.get("/api/waidcup/matches", async () => ({ matches: getWaidcupMatches(database, tournamentId) }));
  app.get("/api/waidcup/live", async () => getWaidcupLive(database, tournamentId));

  // Webcam: gleiches Standbild wie die Spielbetriebsseite, aus dem vom Admin
  // gepflegten Cache (kein Kamera-Abruf pro Client).
  app.get("/api/webcam", async (_request, reply) => {
    const frame = await getWebcamFrame(config);
    if (!frame) {
      return reply.code(502).send({ error: "Webcam nicht erreichbar." });
    }
    return reply
      .header("Content-Type", frame.contentType)
      .header("Cache-Control", "no-store")
      .send(frame.body);
  });

  if (existsSync(WEB_DIST_DIR)) {
    app.register(fastifyStatic, { root: WEB_DIST_DIR });
  }
  // Hash-Routing: keine Server-Routen ausser "/" und den Assets; unbekannte
  // Pfade liefern strikt 404 (keine internen Dateien erreichbar).
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not Found" });
  });

  return app;
}
