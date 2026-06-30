/**
 * Gecachter HTTP-Zugriff auf Swisstennis (serverseitig, nie aus dem Browser).
 *
 * In-Memory-Cache mit TTL je URL. Schlägt ein Abruf fehl, werden – sofern
 * vorhanden – die zuletzt erfolgreich geladenen Daten zurückgegeben, damit die
 * UI nicht leer bleibt.
 */
import { parseSwisstennisXml } from "./xml.js";

const USER_AGENT = "TCW-Interclub/1.0";

interface CacheEntry {
  fetchedAt: number;
  payload: unknown;
}

export class SwisstennisClient {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs: number,
    private readonly timeoutMs: number,
  ) {}

  /**
   * Lädt eine Swisstennis-Antwort (XML) und gibt sie als geparste Objektform
   * zurück. Bei Fehlern werden – sofern vorhanden – die zuletzt erfolgreich
   * geladenen Daten zurückgegeben.
   */
  async fetchData(url: string): Promise<unknown> {
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.ttlMs) {
      return cached.payload;
    }
    try {
      const payload = await this.requestData(url);
      this.cache.set(url, { fetchedAt: now, payload });
      return payload;
    } catch (error) {
      if (cached) {
        return cached.payload;
      }
      throw error;
    }
  }

  private async requestData(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/xml" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Swisstennis antwortete mit HTTP ${response.status} für ${url}`);
      }
      return parseSwisstennisXml(await response.text());
    } finally {
      clearTimeout(timeout);
    }
  }
}
