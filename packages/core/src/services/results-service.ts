/**
 * Ergebnis-Dienst: lädt Interclub-Daten serverseitig von Swisstennis und gibt
 * normalisierte DTOs zurück. Hält einen gemeinsamen, gecachten Client.
 */
import type {
  BracketResponse,
  EncountDetailResponse,
  ResultsTeamsResponse,
  ResultType,
  TeamResultsResponse,
} from "@tcw/shared";
import type { AppConfig } from "../config.js";
import { SwisstennisClient } from "../integrations/swisstennis/raw-client.js";
import {
  drawResultsUrl,
  encountResultsUrl,
  entryPageUrl,
  normalizeYear,
  teamResultsUrl,
} from "../integrations/swisstennis/urls.js";
import { mapEntryPageToTeams } from "../integrations/swisstennis/map-teams.js";
import { mapTeamResults } from "../integrations/swisstennis/map-team-results.js";
import { mapEncountDetail } from "../integrations/swisstennis/map-encount.js";
import { mapDrawResults } from "../integrations/swisstennis/map-draw.js";

export interface ResultsService {
  listTeams(year: string): Promise<ResultsTeamsResponse>;
  getTeamResults(teamId: number, year: string): Promise<TeamResultsResponse>;
  getEncountDetail(encountId: number, year: string, type: ResultType): Promise<EncountDetailResponse>;
  getDraw(ligueId: number, promotion: 0 | 1, year: string): Promise<BracketResponse>;
}

export function createResultsService(config: AppConfig): ResultsService {
  const client = new SwisstennisClient(
    config.swisstennisCacheTtlSeconds * 1000,
    config.swisstennisTimeoutMs,
  );

  return {
    async listTeams(year) {
      const payload = await client.fetchJson(entryPageUrl(year));
      return { items: mapEntryPageToTeams(payload) };
    },
    async getTeamResults(teamId, year) {
      const payload = await client.fetchJson(teamResultsUrl(teamId, year));
      return mapTeamResults(payload, normalizeYear(year));
    },
    async getEncountDetail(encountId, year, type) {
      const payload = await client.fetchJson(encountResultsUrl(encountId, year, type));
      return mapEncountDetail(payload, encountId, normalizeYear(year), type);
    },
    async getDraw(ligueId, promotion, year) {
      const payload = await client.fetchJson(drawResultsUrl(ligueId, promotion, year));
      return mapDrawResults(payload);
    },
  };
}
