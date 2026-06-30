/**
 * Ergebnis-Dienst: lädt team-basierte Resultate (Interclub oder Team-Challenge)
 * serverseitig von Swisstennis und gibt normalisierte DTOs zurück. Hält einen
 * gemeinsamen, gecachten Client.
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
import { INTERCLUB, type Competition } from "../integrations/swisstennis/competition.js";
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

export function createResultsService(
  config: AppConfig,
  competition: Competition = INTERCLUB,
): ResultsService {
  const client = new SwisstennisClient(
    config.resultsCacheTtlSeconds * 1000,
    config.swisstennisTimeoutMs,
  );
  const { urlPrefix, hasBrackets, mytennisPath, normalize } = competition;

  return {
    async listTeams(year) {
      const payload = normalize(await client.fetchData(entryPageUrl(urlPrefix, year)));
      return { items: mapEntryPageToTeams(payload) };
    },
    async getTeamResults(teamId, year) {
      const payload = normalize(await client.fetchData(teamResultsUrl(urlPrefix, teamId, year)));
      return mapTeamResults(payload, normalizeYear(year), { brackets: hasBrackets });
    },
    async getEncountDetail(encountId, year, type) {
      const payload = normalize(await client.fetchData(encountResultsUrl(urlPrefix, encountId, year, type)));
      return mapEncountDetail(payload, encountId, normalizeYear(year), type, mytennisPath);
    },
    async getDraw(ligueId, promotion, year) {
      const payload = normalize(await client.fetchData(drawResultsUrl(urlPrefix, ligueId, promotion, year)));
      return mapDrawResults(payload);
    },
  };
}
