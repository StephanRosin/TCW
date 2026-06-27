/**
 * Ergebnis-Routen: serverseitige Swisstennis-Abfragen mit Validierung.
 *
 * Dieselben Handler bedienen Interclub (`/api/ic/*`) und Team-Challenge
 * (`/api/tc/*`) – nur der Service (Wettbewerb) unterscheidet sich.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createResultsService,
  INTERCLUB,
  TEAM_CHALLENGE,
  type AppConfig,
  type ResultsService,
} from "@tcw/core";
import type { ResultType } from "@tcw/shared";

function parsePositiveInt(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

function resultTypeFromQuery(value: unknown): ResultType {
  return value === "tableau" ? "tableau" : "encount";
}

function registerResultRoutes(app: FastifyInstance, basePath: string, service: ResultsService): void {
  app.get(`${basePath}/teams`, async (request) => {
    const { year } = request.query as { year?: string };
    return service.listTeams(year ?? "");
  });

  app.get(`${basePath}/team/:teamId`, async (request: FastifyRequest, reply: FastifyReply) => {
    const { teamId } = request.params as { teamId: string };
    const { year } = request.query as { year?: string };
    const parsedTeamId = parsePositiveInt(teamId);
    if (parsedTeamId === null) {
      return reply.code(400).send({ error: "Ungültige TeamId" });
    }
    return service.getTeamResults(parsedTeamId, year ?? "");
  });

  app.get(`${basePath}/encount/:encountId`, async (request: FastifyRequest, reply: FastifyReply) => {
    const { encountId } = request.params as { encountId: string };
    const { year, type } = request.query as { year?: string; type?: string };
    const parsedEncountId = parsePositiveInt(encountId);
    if (parsedEncountId === null) {
      return reply.code(400).send({ error: "Ungültige EncountId" });
    }
    return service.getEncountDetail(parsedEncountId, year ?? "", resultTypeFromQuery(type));
  });

  app.get(`${basePath}/draw`, async (request: FastifyRequest, reply: FastifyReply) => {
    const { ligueId, promotion, year } = request.query as {
      ligueId?: string;
      promotion?: string;
      year?: string;
    };
    const parsedLigueId = parsePositiveInt(ligueId);
    if (parsedLigueId === null) {
      return reply.code(400).send({ error: "Ungültige LigueId" });
    }
    if (promotion !== "0" && promotion !== "1") {
      return reply.code(400).send({ error: "Ungültiger Promotion-Wert" });
    }
    return service.getDraw(parsedLigueId, promotion === "1" ? 1 : 0, year ?? "");
  });
}

export function registerIcResultRoutes(app: FastifyInstance, config: AppConfig): void {
  registerResultRoutes(app, "/api/ic", createResultsService(config, INTERCLUB));
  registerResultRoutes(app, "/api/tc", createResultsService(config, TEAM_CHALLENGE));
}
