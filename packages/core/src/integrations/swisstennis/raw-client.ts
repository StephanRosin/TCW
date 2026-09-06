/**
 * Gecachter HTTP-Zugriff auf Swisstennis (serverseitig, nie aus dem Browser).
 *
 * In-Memory-Cache mit TTL je URL. Schlägt ein Abruf fehl, werden – sofern
 * vorhanden – die zuletzt erfolgreich geladenen Daten zurückgegeben, damit die
 * UI nicht leer bleibt.
 */
import { parseSwisstennisXml } from "./xml.js";
import { requestSwisstennis, readResponseText } from "./http.js";

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
    const response = await requestSwisstennis(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/xml, text/xml" },
      timeoutMs: this.timeoutMs,
    });
    return parseSwisstennisXml(await readResponseText(response));
  }

  /**
   * Wie `fetchData`, aber für die Turnier-API (JSON statt XML).
   *
   * Die Servlets unter `/advantage/` verlangen seit dem 19.08.2026 eine
   * angemeldete Session. Turnierdaten kommen deshalb von der API, die
   * mytennis.ch selbst benutzt – sie antwortet ohne Anmeldung, aber nur mit
   * `Origin` und `Referer` auf mytennis.ch.
   */
  async fetchTournamentData(url: string): Promise<unknown> {
    const cached = this.cache.get(url);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.ttlMs) {
      return cached.payload;
    }
    try {
      const payload = await this.requestTournamentData(url);
      this.cache.set(url, { fetchedAt: now, payload });
      return payload;
    } catch (error) {
      if (cached) {
        return cached.payload;
      }
      throw error;
    }
  }

  private async requestTournamentData(url: string): Promise<unknown> {
    const response = await requestSwisstennis(url, {
      headers: {
        Origin: "https://www.mytennis.ch",
        Referer: "https://www.mytennis.ch/",
        Accept: "application/json",
      },
      timeoutMs: this.timeoutMs,
    });
    // Ein Tableau-Abruf auf eine Gruppen-Konkurrenz antwortet mit 204 und
    // leerem Rumpf statt mit einem Fehler.
    const text = await readResponseText(response);
    return text.trim() === "" ? null : JSON.parse(text);
  }
}
