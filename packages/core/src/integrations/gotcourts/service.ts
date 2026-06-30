/**
 * Dienst für die Platzbelegung: holt die GotCourts-Tagesliste (mit kurzem
 * Cache je Datum) und formt daraus die Anzeige-Blöcke. Fehler oder fehlende
 * Konfiguration ergeben `available: false` statt eines harten Fehlers, damit
 * die öffentliche Seite robust bleibt.
 */
import type { CourtsResponse } from "@tcw/shared";
import {
  fetchReservationList,
  type GotCourtsCredentials,
  type GotCourtsReservationList,
} from "./client.js";
import { buildCourtBlocks } from "./occupancy.js";

const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_OFFSET_DAYS = 14;

interface CacheEntry {
  fetchedAt: number;
  list: GotCourtsReservationList;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Zielzeitpunkt: optionaler ISO-Wert (für Tests) oder jetzt. Datum auf ±14 Tage begrenzt. */
function resolveTarget(atIso: string | undefined): { date: string; nowSec: number } {
  const now = new Date();
  const match = atIso?.match(DATE_PATTERN);
  if (!match) {
    return { date: localDate(now), nowSec: now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() };
  }
  const requested = new Date(`${match[1]}T00:00:00`);
  const diffDays = Math.abs((requested.getTime() - new Date(localDate(now) + "T00:00:00").getTime()) / 86_400_000);
  const date = diffDays <= MAX_OFFSET_DAYS ? match[1]! : localDate(now);
  const nowSec =
    match[2] !== undefined
      ? Number(match[2]) * 3600 + Number(match[3]) * 60
      : now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return { date, nowSec };
}

export class GotCourtsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly credentials: GotCourtsCredentials | null) {}

  private async listForDate(date: string): Promise<GotCourtsReservationList> {
    const cached = this.cache.get(date);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.list;
    }
    const list = await fetchReservationList(this.credentials!, date);
    this.cache.set(date, { fetchedAt: now, list });
    return list;
  }

  /** Liefert die Belegungs-Blöcke; `atIso` überschreibt den Zeitpunkt (Tests). */
  async getOccupancy(atIso?: string): Promise<CourtsResponse> {
    const { date, nowSec } = resolveTarget(atIso);
    if (!this.credentials) {
      return { date, available: false, blocks: [] };
    }
    try {
      const list = await this.listForDate(date);
      return { date, available: true, blocks: buildCourtBlocks(list, nowSec) };
    } catch {
      return { date, available: false, blocks: [] };
    }
  }
}
