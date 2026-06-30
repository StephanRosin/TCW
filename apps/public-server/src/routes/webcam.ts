/**
 * Webcam-Proxy für die "Plätze"-Seite.
 *
 * Das Kamera-Standbild liegt auf einem internen Host nur per HTTP vor. Würde der
 * Browser es direkt laden, verstiesse das gegen die Content-Security-Policy
 * (img-src) und – bei künftigem HTTPS-Betrieb – gegen die Mixed-Content-Regel.
 * Der Proxy liefert dasselbe Bild same-origin aus; der interne Host bleibt
 * verborgen. Feste Ziel-URL ohne Nutzereingabe – kein SSRF-Risiko.
 */
import type { FastifyInstance } from "fastify";

const WEBCAM_SNAPSHOT_URL = "http://tcwaidberg.no-ip.org:10554/streaming/channels/2/picture";
const TIMEOUT_MS = 8000;

export function registerWebcamRoute(app: FastifyInstance): void {
  app.get("/api/webcam", async (_request, reply) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(WEBCAM_SNAPSHOT_URL, { signal: controller.signal });
      if (!response.ok) {
        return reply.code(502).send({ error: "Webcam nicht erreichbar." });
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return reply
        .header("Content-Type", response.headers.get("content-type") ?? "image/jpeg")
        .header("Cache-Control", "no-store")
        .send(buffer);
    } catch {
      return reply.code(502).send({ error: "Webcam nicht erreichbar." });
    } finally {
      clearTimeout(timeout);
    }
  });
}
