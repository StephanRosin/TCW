/**
 * Webcam-Route für die "Plätze"-Seite.
 *
 * Liefert das vom Admin-Poller gepflegte Standbild (data/webcam-latest.jpg)
 * same-origin aus – kein Kamera-Abruf pro Client. Fehlt der Cache oder ist er
 * veraltet (Admin aus), holt getWebcamFrame einmalig direkt und fällt sonst auf
 * das letzte bekannte Bild zurück. Der interne Kamera-Host bleibt verborgen.
 */
import type { FastifyInstance } from "fastify";
import { getWebcamFrame, type AppConfig } from "@tcw/core";

export function registerWebcamRoute(app: FastifyInstance, config: AppConfig): void {
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
}
