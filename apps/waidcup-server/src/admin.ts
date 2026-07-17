/**
 * Waidcup-Adminseite (serverseitiger Teil): schlanke, login-geschützte API.
 *
 * Erst mal nur eine Aktion: den Order-of-Play-Sofort-Refresh auslösen (frischer
 * Swisstennis-Abruf am Cache vorbei). Auth ist dependency-frei über ein
 * HMAC-signiertes HttpOnly-Cookie; das Passwort kommt ausschliesslich aus der
 * Server-Env (WAIDCUP_ADMIN_PASSWORD, nie ins Repo), der Cookie-Secret wird
 * daraus abgeleitet. Ist kein Passwort gesetzt, ist die Adminseite deaktiviert.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  openDatabase,
  readTournamentConfigs,
  refreshOrderOfPlay,
  type AppConfig,
  type TournamentConfig,
} from "@tcw/core";

const COOKIE = "wc_admin";
const ADMIN_USER = "admin";
const SESSION_MS = 12 * 60 * 60 * 1000; // 12 h

function secretFor(password: string): Buffer {
  return createHash("sha256").update(`waidcup-admin::${password}`).digest();
}

function sign(value: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function makeToken(expiry: number, secret: Buffer): string {
  return `${expiry}.${sign(String(expiry), secret)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function verifyToken(token: string | undefined, secret: Buffer): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expiryPart = token.slice(0, dot);
  const expiry = Number(expiryPart);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  return safeEqual(token.slice(dot + 1), sign(expiryPart, secret));
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq > 0 && trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

function isAuthed(request: FastifyRequest, secret: Buffer): boolean {
  return verifyToken(cookieValue(request.headers.cookie, COOKIE), secret);
}

/** Öffnet kurz eine schreibende Verbindung und aktualisiert den Order of Play. */
async function runRefresh(config: AppConfig): Promise<Awaited<ReturnType<typeof refreshOrderOfPlay>>> {
  const database = openDatabase({ filePath: config.dbFilePath });
  try {
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
    return await refreshOrderOfPlay(config, database, tournamentConfig);
  } finally {
    database.close();
  }
}

export function registerWaidcupAdmin(app: FastifyInstance, config: AppConfig): void {
  const password = config.waidcupAdminPassword;
  const enabled = password !== "";
  const secret = secretFor(password);
  // LAN läuft über http (kein Secure-Flag, sonst käme das Cookie nicht mit).
  const setCookie = (token: string, maxAgeSeconds: number): string =>
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;

  app.get("/api/waidcup/admin/session", async (request) => ({
    enabled,
    authenticated: enabled && isAuthed(request, secret),
  }));

  app.post("/api/waidcup/admin/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!enabled) return reply.code(503).send({ error: "Adminseite ist nicht konfiguriert." });
    const body = (request.body ?? {}) as { username?: unknown; password?: unknown };
    const user = typeof body.username === "string" ? body.username : ADMIN_USER;
    const pass = typeof body.password === "string" ? body.password : "";
    if (user !== ADMIN_USER || !safeEqual(pass, password)) {
      return reply.code(401).send({ error: "Login fehlgeschlagen." });
    }
    reply.header("Set-Cookie", setCookie(makeToken(Date.now() + SESSION_MS, secret), SESSION_MS / 1000));
    return { ok: true };
  });

  app.post("/api/waidcup/admin/logout", async (_request, reply) => {
    reply.header("Set-Cookie", setCookie("", 0));
    return { ok: true };
  });

  app.post(
    "/api/waidcup/admin/order-of-play/refresh",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!enabled) return reply.code(503).send({ error: "Adminseite ist nicht konfiguriert." });
      if (!isAuthed(request, secret)) return reply.code(401).send({ error: "Nicht angemeldet." });
      const result = await runRefresh(config);
      return { ...result, at: new Date().toISOString() };
    },
  );
}
