/**
 * Typisierter Zugriff auf die öffentliche API.
 */
import type {
  AgendaResponse,
  BracketResponse,
  CourtsResponse,
  EncountDetailResponse,
  MatchesResponse,
  PlayerMatchesResponse,
  PlayerSuggestion,
  PublicTeamsResponse,
  RankingChangesResponse,
  ResultsTeamsResponse,
  ResultType,
  SiteSettings,
  TeamResultsResponse,
  TournamentsResponse,
  TrainingPlanResponse,
} from "@tcw/shared";

async function fetchJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} bei ${url}`);
  }
  return (await response.json()) as TResponse;
}

/** Team-basierte Resultat-Endpunkte (Interclub bzw. Team-Challenge) – identisches Schema. */
export interface ResultsApi {
  teams: (year: string) => Promise<ResultsTeamsResponse>;
  team: (teamId: number, year: string) => Promise<TeamResultsResponse>;
  encount: (encountId: number, year: string, type: ResultType) => Promise<EncountDetailResponse>;
  draw: (ligueId: number, promotion: 0 | 1, year: string) => Promise<BracketResponse>;
}

function resultsApi(basePath: string): ResultsApi {
  return {
    teams: (year) =>
      fetchJson<ResultsTeamsResponse>(`${basePath}/teams?year=${encodeURIComponent(year)}`),
    team: (teamId, year) =>
      fetchJson<TeamResultsResponse>(`${basePath}/team/${teamId}?year=${encodeURIComponent(year)}`),
    encount: (encountId, year, type) =>
      fetchJson<EncountDetailResponse>(
        `${basePath}/encount/${encountId}?year=${encodeURIComponent(year)}&type=${type}`,
      ),
    draw: (ligueId, promotion, year) =>
      fetchJson<BracketResponse>(
        `${basePath}/draw?ligueId=${ligueId}&promotion=${promotion}&year=${encodeURIComponent(year)}`,
      ),
  };
}

export const publicApi = {
  teams: () => fetchJson<PublicTeamsResponse>("/api/teams"),
  trainingPlan: () => fetchJson<TrainingPlanResponse>("/api/training-slots"),
  rankingChanges: () => fetchJson<RankingChangesResponse>("/api/ranking-changes"),
  matches: () => fetchJson<MatchesResponse>("/api/matches"),
  tournaments: () => fetchJson<TournamentsResponse>("/api/tournaments"),
  agenda: () => fetchJson<AgendaResponse>("/api/agenda"),
  courts: (at?: string) =>
    fetchJson<CourtsResponse>(at ? `/api/courts?at=${encodeURIComponent(at)}` : "/api/courts"),
  settings: () => fetchJson<SiteSettings>("/api/settings"),
  playerSuggest: (q: string) =>
    fetchJson<{ items: PlayerSuggestion[] }>(`/api/player-matches/suggest?q=${encodeURIComponent(q)}`),
  playerMatches: (key: string, name: string) =>
    fetchJson<PlayerMatchesResponse>(
      `/api/player-matches?key=${encodeURIComponent(key)}&name=${encodeURIComponent(name)}`,
    ),
  ic: resultsApi("/api/ic"),
  tc: resultsApi("/api/tc"),
};
