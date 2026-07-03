/**
 * Gemeinsamer Webcam-Cache.
 *
 * Statt dass jeder Client (und jede Seite) alle 10 s ein Bild direkt von der
 * Kamera zieht, holt EIN Poller im Admin-Prozess das Standbild alle 10 s und
 * legt es atomar unter data/webcam-latest.jpg ab. Public- und Waidcup-Server
 * liefern dieses Bild same-origin aus – die Kamera-Last ist damit 1 Abruf/10 s,
 * unabhängig von der Zuschauerzahl.
 *
 * Feste Ziel-URL ohne Nutzereingabe – kein SSRF-Risiko.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AppConfig } from "../../config.js";

export const WEBCAM_SNAPSHOT_URL = "http://tcwaidberg.no-ip.org:10554/streaming/channels/2/picture";
const TIMEOUT_MS = 8000;
/** Gilt der Cache als frisch, wird ohne Kamera-Abruf ausgeliefert. */
const FRESH_MS = 30_000;

export interface WebcamFrame {
  body: Buffer;
  contentType: string;
}

export function webcamCacheFile(config: AppConfig): string {
  return resolve(config.repoRoot, "data/webcam-latest.jpg");
}

/** Holt ein frisches Standbild direkt von der Kamera. */
export async function fetchWebcamSnapshot(): Promise<WebcamFrame> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(WEBCAM_SNAPSHOT_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Webcam HTTP ${response.status}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    return { body, contentType: response.headers.get("content-type") ?? "image/jpeg" };
  } finally {
    clearTimeout(timeout);
  }
}

/** Schreibt das Standbild atomar in den gemeinsamen Cache (Poller im Admin). */
export function writeWebcamSnapshot(config: AppConfig, body: Buffer): void {
  const file = webcamCacheFile(config);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, file);
}

function readCachedFrame(config: AppConfig): { body: Buffer; ageMs: number } | null {
  const file = webcamCacheFile(config);
  if (!existsSync(file)) {
    return null;
  }
  try {
    const stat = statSync(file);
    return { body: readFileSync(file), ageMs: Date.now() - stat.mtimeMs };
  } catch {
    return null;
  }
}

/**
 * Liefert das aktuellste Standbild zum Ausliefern: bevorzugt den vom Admin
 * gepflegten Cache; ist er zu alt oder fehlt er (Admin aus), wird einmalig
 * direkt geholt. Schlägt auch das fehl, dient das letzte bekannte Bild als
 * Rückfallebene. `null` nur, wenn nie ein Bild vorlag.
 */
export async function getWebcamFrame(config: AppConfig): Promise<WebcamFrame | null> {
  const cached = readCachedFrame(config);
  if (cached && cached.ageMs < FRESH_MS) {
    return { body: cached.body, contentType: "image/jpeg" };
  }
  try {
    return await fetchWebcamSnapshot();
  } catch {
    return cached ? { body: cached.body, contentType: "image/jpeg" } : null;
  }
}
