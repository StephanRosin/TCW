/**
 * Optionale HTTP-Basic-Authentifizierung für den Admin-Server.
 *
 * Aktiv, sobald `IC_ADMIN_USER` und `IC_ADMIN_PASSWORD` gesetzt sind. Ohne
 * gesetzte Zugangsdaten bleibt der Server offen (nur für lokalen Dev-Betrieb).
 * Der Health-Endpunkt ist ausgenommen, damit Monitoring ohne Credentials geht.
 */
import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@tcw/core";

function constantTimeEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function registerAdminAuth(app: FastifyInstance, config: AppConfig): void {
  if (config.adminUser === "" || config.adminPassword === "") {
    app.log.warn("Admin-Server läuft OHNE Authentifizierung (IC_ADMIN_USER/IC_ADMIN_PASSWORD nicht gesetzt).");
    return;
  }
  const expectedHeader =
    "Basic " + Buffer.from(`${config.adminUser}:${config.adminPassword}`).toString("base64");

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/api/health") {
      return;
    }
    const provided = request.headers.authorization ?? "";
    if (!constantTimeEquals(provided, expectedHeader)) {
      reply
        .header("WWW-Authenticate", 'Basic realm="TCW Admin", charset="UTF-8"')
        .code(401)
        .send({ error: "Authentifizierung erforderlich." });
    }
  });
  app.log.info("Admin-Server: Basic-Authentifizierung aktiv.");
}
