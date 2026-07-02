/**
 * Typisierter Zugriff auf die Waidcup-API.
 */
import type { TournamentEventView, TournamentMatch, WaidcupLiveResponse } from "@tcw/shared";

async function fetchJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} bei ${url}`);
  }
  return (await response.json()) as TResponse;
}

export const waidcupApi = {
  brackets: () => fetchJson<{ events: TournamentEventView[] }>("/api/waidcup/brackets"),
  matches: () => fetchJson<{ matches: TournamentMatch[] }>("/api/waidcup/matches"),
  live: () => fetchJson<WaidcupLiveResponse>("/api/waidcup/live"),
};
