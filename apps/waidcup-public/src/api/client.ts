/**
 * Typisierter Zugriff auf die Waidcup-API. Eventnamen werden hier zentral
 * fürs Display aufbereitet (Aktiv-Kürzel "A" entfernt), damit alle Ansichten
 * (Chips, Matchliste, Live-Board, Kiosk) dieselben Namen zeigen.
 */
import type {
  TournamentEventView,
  TournamentMatch,
  WaidcupLiveMatch,
  WaidcupLiveResponse,
} from "@tcw/shared";
import { displayEventName } from "../lib/events.js";

async function fetchJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} bei ${url}`);
  }
  return (await response.json()) as TResponse;
}

function withDisplayName<T extends { eventName: string }>(item: T): T {
  return { ...item, eventName: displayEventName(item.eventName) };
}

export const waidcupApi = {
  brackets: async (): Promise<{ events: TournamentEventView[] }> => {
    const data = await fetchJson<{ events: TournamentEventView[] }>("/api/waidcup/brackets");
    return { events: data.events.map(withDisplayName) };
  },
  matches: async (): Promise<{ matches: TournamentMatch[]; playerUrls: Record<string, string> }> => {
    const data = await fetchJson<{ matches: TournamentMatch[]; playerUrls: Record<string, string> }>(
      "/api/waidcup/matches",
    );
    return { matches: data.matches.map(withDisplayName), playerUrls: data.playerUrls };
  },
  live: async (): Promise<WaidcupLiveResponse> => {
    const data = await fetchJson<WaidcupLiveResponse>("/api/waidcup/live");
    return { ...data, now: data.now.map(withDisplayName), upcoming: data.upcoming.map(withDisplayName) };
  },
  orderOfPlay: async (): Promise<{
    today: WaidcupLiveMatch[];
    tomorrow: WaidcupLiveMatch[];
    playerUrls: Record<string, string>;
  }> => {
    const data = await fetchJson<{
      today: WaidcupLiveMatch[];
      tomorrow: WaidcupLiveMatch[];
      playerUrls: Record<string, string>;
    }>("/api/waidcup/order-of-play");
    return {
      today: data.today.map(withDisplayName),
      tomorrow: data.tomorrow.map(withDisplayName),
      playerUrls: data.playerUrls,
    };
  },
};
