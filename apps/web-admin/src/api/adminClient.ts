/**
 * Typisierter Zugriff auf die Admin-API mit aussagekräftiger Fehlerweitergabe.
 */
import type {
  AdminPlayer,
  AdminRankingChange,
  AdminTeam,
  AdminTournament,
  AdminTrainingSlot,
} from "@tcw/shared";

async function request<TResponse>(url: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return data as TResponse;
}

function items<T>(url: string): Promise<T[]> {
  return request<{ items: T[] }>(url).then((data) => data.items);
}

export interface UpdateKlassierungResponse {
  ok: true;
  output: string;
}

export const adminApi = {
  teams: () => items<AdminTeam>("/api/teams"),
  createTeam: (body: Record<string, unknown>) => request("/api/teams", { method: "POST", body: JSON.stringify(body) }),
  updateTeam: (id: number, body: Record<string, unknown>) =>
    request(`/api/teams/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTeam: (id: number) => request(`/api/teams/${id}`, { method: "DELETE" }),

  players: () => items<AdminPlayer>("/api/players"),
  createPlayer: (body: Record<string, unknown>) =>
    request("/api/players", { method: "POST", body: JSON.stringify(body) }),
  updatePlayer: (id: number, body: Record<string, unknown>) =>
    request(`/api/players/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePlayer: (id: number) => request(`/api/players/${id}`, { method: "DELETE" }),

  trainingSlots: () => items<AdminTrainingSlot>("/api/training-slots"),
  saveTrainingGrid: (gridItems: unknown[]) =>
    request("/api/training-slots/bulk", { method: "POST", body: JSON.stringify({ items: gridItems }) }),

  rankingChanges: () => items<AdminRankingChange>("/api/ranking-changes"),
  updateRankingChange: (id: number, body: Record<string, unknown>) =>
    request(`/api/ranking-changes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteRankingChange: (id: number) => request(`/api/ranking-changes/${id}`, { method: "DELETE" }),

  tournaments: () => items<AdminTournament>("/api/tournaments"),
  saveTournaments: (tournamentItems: unknown[]) =>
    request("/api/tournaments", { method: "POST", body: JSON.stringify({ items: tournamentItems }) }),
  refreshTournament: (id: number) => request(`/api/tournaments/${id}/refresh`, { method: "POST" }),

  updateKlassierung: () =>
    request<UpdateKlassierungResponse>("/api/actions/update-klassierung", { method: "POST" }),
  importMatches: () => request<{ ok: true; count: number }>("/api/actions/import-matches", { method: "POST" }),
};
