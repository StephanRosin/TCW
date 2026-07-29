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
  getWaidcupOrderOfPlay,
  getWaidcupResults,
  getWaidcupPlayerUrls,
  getWebcamFrame,
  loadConfig,
  openDatabase,
  PUBLIC_SECURITY_HEADERS,
  readWaidcupGallery,
  SERVER_LOGGER_OPTIONS,
  type AppConfig,
} from "@tcw/core";
import type { HealthResponse } from "@tcw/shared";
import { registerWaidcupAdmin } from "./admin.js";

const WEB_DIST_DIR = resolve(loadConfig().repoRoot, "apps/waidcup-public/dist");
const GALLERY_CACHE_MS = 60_000;

/** Merkt sich das Ergebnis für `ttlMs`, damit jeder Aufruf nicht die Platte liest. */
function cached<T>(read: () => T, ttlMs: number): () => T {
  let value: T | null = null;
  let readAt = 0;
  return () => {
    const now = Date.now();
    if (value === null || now - readAt > ttlMs) {
      value = read();
      readAt = now;
    }
    return value;
  };
}

export async function buildWaidcupApp(config: AppConfig = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({ logger: { ...SERVER_LOGGER_OPTIONS } });
  // Einmalig schreibend öffnen, damit das Schema (u. a. waidcup_payments für die
  // Adminseite) sicher existiert; danach nur noch lesend fürs Serving.
  openDatabase({ filePath: config.dbFilePath }).close();
  const database = openDatabase({ filePath: config.dbFilePath, readonly: true });
  const tournamentId = config.waidcupTournamentId;

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    // Galeriebilder sind statische Dateien und werden nicht mitgezählt: eine
    // Tagesansicht fordert mehrere hundert Kacheln an und würde das für die
    // API gedachte Limit sonst sofort sprengen (ab der 201. Datei kam 429,
    // die restlichen Kacheln blieben leer).
    allowList: (request) => request.url.startsWith("/gallery/"),
  });

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

  app.get("/api/waidcup/brackets", async () => ({
    events: getWaidcupBrackets(database, tournamentId),
    playerUrls: getWaidcupPlayerUrls(database, tournamentId),
  }));
  app.get("/api/waidcup/matches", async () => ({
    matches: getWaidcupMatches(database, tournamentId),
    playerUrls: getWaidcupPlayerUrls(database, tournamentId),
  }));
  app.get("/api/waidcup/live", async () => getWaidcupLive(database, tournamentId));
  app.get("/api/waidcup/order-of-play", async () => ({
    today: getWaidcupOrderOfPlay(database, tournamentId, new Date(), 0),
    tomorrow: getWaidcupOrderOfPlay(database, tournamentId, new Date(), 1),
    playerUrls: getWaidcupPlayerUrls(database, tournamentId),
    // Ist alles gespielt, tritt die Siegerübersicht an die Stelle des Spielplans.
    results: getWaidcupResults(database, tournamentId),
  }));
  // Fotogalerie: Verzeichnis-Scan, kurz gepuffert (ein neuer Jahrgang ist nach
  // spätestens einer Minute sichtbar, ohne Neustart). Eigenes Limit, weil die
  // Route – anders als die übrigen – auf die Platte zugreift.
  const gallery = cached(() => readWaidcupGallery(config.waidcupGalleryDir), GALLERY_CACHE_MS);
  app.get(
    "/api/waidcup/gallery",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async () => gallery(),
  );

  // Login-geschützte Adminseite (Order-of-Play-Refresh + Bezahlt-Tracking).
  registerWaidcupAdmin(app, config, database);

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
  // Galeriebilder liegen ausserhalb des Repos; unveränderliche Dateinamen je
  // Jahrgang, daher lange cachebar.
  if (existsSync(config.waidcupGalleryDir)) {
    app.register(fastifyStatic, {
      root: resolve(config.waidcupGalleryDir),
      prefix: "/gallery/",
      decorateReply: false,
      cacheControl: true,
      maxAge: "30d",
      index: false,
      list: false,
    });
  }
  // Hash-Routing: keine Server-Routen ausser "/" und den Assets; unbekannte
  // Pfade liefern strikt 404 (keine internen Dateien erreichbar).
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not Found" });
  });

  return app;
}
