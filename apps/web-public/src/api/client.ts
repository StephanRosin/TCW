/**
 * Typisierter Zugriff auf die öffentliche API.
 */
import type {
  AgendaResponse,
  BracketResponse,
  EncountDetailResponse,
  MatchesResponse,
  PublicTeamsResponse,
  RankingChangesResponse,
  ResultsTeamsResponse,
  ResultType,
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

export const publicApi = {
  teams: () => fetchJson<PublicTeamsResponse>("/api/teams"),
  trainingPlan: () => fetchJson<TrainingPlanResponse>("/api/training-slots"),
  rankingChanges: () => fetchJson<RankingChangesResponse>("/api/ranking-changes"),
  matches: () => fetchJson<MatchesResponse>("/api/matches"),
  tournaments: () => fetchJson<TournamentsResponse>("/api/tournaments"),
  agenda: () => fetchJson<AgendaResponse>("/api/agenda"),
  ic: {
    teams: (year: string) =>
      fetchJson<ResultsTeamsResponse>(`/api/ic/teams?year=${encodeURIComponent(year)}`),
    team: (teamId: number, year: string) =>
      fetchJson<TeamResultsResponse>(`/api/ic/team/${teamId}?year=${encodeURIComponent(year)}`),
    encount: (encountId: number, year: string, type: ResultType) =>
      fetchJson<EncountDetailResponse>(
        `/api/ic/encount/${encountId}?year=${encodeURIComponent(year)}&type=${type}`,
      ),
    draw: (ligueId: number, promotion: 0 | 1, year: string) =>
      fetchJson<BracketResponse>(
        `/api/ic/draw?ligueId=${ligueId}&promotion=${promotion}&year=${encodeURIComponent(year)}`,
      ),
  },
};
