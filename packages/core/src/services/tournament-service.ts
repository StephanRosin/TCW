/**
 * Native Turnier-Integration: lädt Turnierdaten von Swisstennis, löst
 * Spielerlinks über MyTennis auf und ersetzt die Importdaten atomar.
 *
 * Bei Fehlern bleiben die zuletzt erfolgreich importierten Daten erhalten.
 */
import { toErrorMessage } from "@tcw/shared";
import type { AppConfig } from "../config.js";
import type { TcwDatabase } from "../db/connection.js";
import { SwisstennisClient } from "../integrations/swisstennis/raw-client.js";
import {
  displayDrawUrl,
  displayPoolsUrl,
  publicDisplayEventUrl,
  tournamentDisplayUrl,
} from "../integrations/swisstennis/tournament-urls.js";
import { mapTournamentMeta, type TournamentEventMeta } from "../integrations/swisstennis/tournament-events.js";
import {
  mapEventRegistrations,
  type RegistrationRecord,
} from "../integrations/swisstennis/tournament-registrations.js";
import {
  mapDrawBracket,
  mapEventMatches,
  mapPoolStandings,
} from "../integrations/swisstennis/tournament-matches.js";
import { resolveMyTennisPlayerUrl } from "../integrations/mytennis/search.js";
import {
  readExistingPlayerUrls,
  readTournamentConfigs,
  recordRefreshError,
  replaceTournamentData,
  type EventImport,
  type ExistingPlayerUrl,
  type TournamentConfig,
} from "./tournament-store.js";

const DOUBLE_MATCH_TYPE_IDS = new Set([3, 4, 5]);
const URL_RESOLVE_CONCURRENCY = 5;

/** Wendet `fn` mit begrenzter Parallelität an (schont MyTennis, verhindert Timeouts). */
async function mapWithLimit<TItem, TResult>(
  items: TItem[],
  limit: number,
  fn: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current]!);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export interface TournamentRefreshOptions {
  resolvePlayerUrls: boolean;
}

export interface TournamentRefreshResult {
  tournamentId: number;
  events: number;
  players: number;
  matches: number;
}

export interface TournamentService {
  refresh(config: TournamentConfig, options: TournamentRefreshOptions): Promise<TournamentRefreshResult>;
  refreshAllActive(options: TournamentRefreshOptions): Promise<TournamentRefreshResult[]>;
}

export function createTournamentService(config: AppConfig, database: TcwDatabase): TournamentService {
  const client = new SwisstennisClient(
    config.swisstennisCacheTtlSeconds * 1000,
    config.swisstennisTimeoutMs,
  );
  const mytennisTimeout = config.swisstennisTimeoutMs;

  async function resolveUrl(firstName: string, lastName: string, license: string | null): Promise<string> {
    if (!license) return "";
    return resolveMyTennisPlayerUrl(firstName, lastName, license, mytennisTimeout);
  }

  async function enrichRegistration(
    record: RegistrationRecord,
    existing: ExistingPlayerUrl | undefined,
    resolvePlayerUrls: boolean,
  ): Promise<RegistrationRecord & { playerUrl: string; playerUrl2: string }> {
    const reuseUrl =
      existing?.licenseNumber === record.licenseNumber && existing?.playerUrl
        ? existing.playerUrl
        : "";
    const reuseUrl2 =
      existing?.licenseNumber2 === record.licenseNumber2 && existing?.playerUrl2
        ? existing.playerUrl2
        : "";

    const playerUrl =
      reuseUrl || (resolvePlayerUrls ? await resolveUrl(record.firstName, record.lastName, record.licenseNumber) : "");
    const playerUrl2 =
      reuseUrl2 ||
      (resolvePlayerUrls && record.licenseNumber2
        ? await resolveUrl(record.firstName2, record.lastName2, record.licenseNumber2)
        : "");

    return { ...record, playerUrl, playerUrl2 };
  }

  async function loadEvent(
    eventMeta: TournamentEventMeta,
    existingUrls: Map<string, ExistingPlayerUrl>,
    resolvePlayerUrls: boolean,
  ): Promise<EventImport> {
    const registrationsPayload = await client.fetchData(publicDisplayEventUrl(eventMeta.eventId));
    const rawRegistrations = mapEventRegistrations(registrationsPayload);
    const registrations = await mapWithLimit(rawRegistrations, URL_RESOLVE_CONCURRENCY, (record) =>
      enrichRegistration(record, existingUrls.get(record.playerKey), resolvePlayerUrls),
    );

    const isDouble = DOUBLE_MATCH_TYPE_IDS.has(eventMeta.matchTypeId);
    const rrUrl = eventMeta.mode === "Round-robin" ? displayPoolsUrl(eventMeta.eventId) : null;
    const matchesUrl = eventMeta.mode === "Draw" ? displayDrawUrl(eventMeta.eventId) : rrUrl;
    const matchesPayload = matchesUrl ? await client.fetchData(matchesUrl) : null;
    const matches = matchesPayload
      ? mapEventMatches(matchesPayload, eventMeta.mode, eventMeta.eventName, eventMeta.eventId, isDouble)
      : [];
    const pools =
      matchesPayload && eventMeta.mode === "Round-robin"
        ? mapPoolStandings(matchesPayload, isDouble)
        : [];
    const bracket =
      matchesPayload && eventMeta.mode === "Draw" ? mapDrawBracket(matchesPayload) : null;

    return { meta: eventMeta, registrations, matches, pools, bracket };
  }

  async function refresh(
    tournamentConfig: TournamentConfig,
    options: TournamentRefreshOptions,
  ): Promise<TournamentRefreshResult> {
    const tournamentId = tournamentConfig.swisstennisTournamentId;
    try {
      const meta = mapTournamentMeta(await client.fetchData(tournamentDisplayUrl(tournamentId)));
      if (meta.events.length === 0) {
        return { tournamentId, events: 0, players: 0, matches: 0 };
      }
      const existingUrls = readExistingPlayerUrls(database, tournamentId);
      const events: EventImport[] = [];
      for (const eventMeta of meta.events) {
        events.push(await loadEvent(eventMeta, existingUrls, options.resolvePlayerUrls));
      }

      const importedAt = new Date().toISOString();
      replaceTournamentData(database, tournamentId, tournamentConfig.name, events, importedAt);

      return {
        tournamentId,
        events: events.length,
        players: events.reduce((sum, event) => sum + event.registrations.length, 0),
        matches: events.reduce((sum, event) => sum + event.matches.length, 0),
      };
    } catch (error) {
      recordRefreshError(database, tournamentId, toErrorMessage(error));
      throw error;
    }
  }

  return {
    refresh,
    async refreshAllActive(options) {
      const configs = readTournamentConfigs(database, true);
      const results: TournamentRefreshResult[] = [];
      for (const tournamentConfig of configs) {
        try {
          results.push(await refresh(tournamentConfig, options));
        } catch {
          // Fehler wurde bereits protokolliert; nächstes Turnier weiter versuchen.
        }
      }
      return results;
    },
  };
}
