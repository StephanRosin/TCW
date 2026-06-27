/**
 * Öffentliche API-Routen: Kerndaten aus der Datenbank.
 *
 * Ergebnisse (IC) und Turniere werden in eigenen Routen-Modulen ergänzt.
 */
import type { FastifyInstance } from "fastify";
import {
  getMatches,
  getPublicAgenda,
  getPublicTeams,
  getPublicTournaments,
  getRankingChanges,
  getTrainingPlan,
  type TcwDatabase,
} from "@tcw/core";

export function registerPublicCoreRoutes(app: FastifyInstance, database: TcwDatabase): void {
  app.get("/api/teams", async () => getPublicTeams(database));
  app.get("/api/training-slots", async () => getTrainingPlan(database));
  app.get("/api/ranking-changes", async () => getRankingChanges(database));
  app.get("/api/matches", async () => getMatches(database));
  app.get("/api/tournaments", async () => getPublicTournaments(database));
  app.get("/api/agenda", async () => getPublicAgenda(database));
}
