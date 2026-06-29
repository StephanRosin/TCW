/**
 * Öffentliche API-Routen: Kerndaten aus der Datenbank.
 *
 * Ergebnisse (IC) und Turniere werden in eigenen Routen-Modulen ergänzt.
 */
import type { FastifyInstance } from "fastify";
import {
  getMatches,
  getPlayerMatches,
  getPublicAgenda,
  getPublicTeams,
  getPublicTournaments,
  getRankingChanges,
  getSiteSettings,
  getTrainingPlan,
  suggestPlayers,
  type TcwDatabase,
} from "@tcw/core";

export function registerPublicCoreRoutes(app: FastifyInstance, database: TcwDatabase): void {
  app.get("/api/teams", async () => getPublicTeams(database));
  app.get("/api/training-slots", async () => getTrainingPlan(database));
  app.get("/api/ranking-changes", async () => getRankingChanges(database));
  app.get("/api/matches", async () => getMatches(database));
  app.get("/api/tournaments", async () => getPublicTournaments(database));
  app.get("/api/agenda", async () => getPublicAgenda(database));
  app.get("/api/settings", async () => getSiteSettings(database));

  app.get<{ Querystring: { q?: string } }>("/api/player-matches/suggest", async (request) => ({
    items: suggestPlayers(database, request.query.q ?? ""),
  }));
  app.get<{ Querystring: { key?: string; name?: string } }>("/api/player-matches", async (request) => {
    const key = (request.query.key ?? "").trim();
    return { player: request.query.name ?? "", matches: key === "" ? [] : getPlayerMatches(database, key) };
  });
}
