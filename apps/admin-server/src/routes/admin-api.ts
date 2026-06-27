/**
 * Admin-API: CRUD für Teams, Spieler, Trainingsslots, Klassierungsänderungen
 * und Turniere sowie Aktionen (Importe, MyTennis-Update).
 *
 * Validierungs- und Konfliktfehler werden vom globalen Error-Handler in
 * passende HTTP-Statuscodes übersetzt.
 */
import type { FastifyInstance } from "fastify";
import {
  createPlayer,
  createTeam,
  deletePlayer,
  deleteRankingChange,
  deleteTeam,
  listAdminTournaments,
  listPlayers,
  listRankingChanges,
  listTeams,
  listTrainingSlots,
  saveTournaments,
  saveTrainingGrid,
  updatePlayer,
  updateRankingChange,
  updateTeam,
  updateKlassierungenFromMyTennis,
  ValidationError,
  type AgendaImporter,
  type AppConfig,
  type MatchesImporter,
  type TcwDatabase,
  type TournamentService,
} from "@tcw/core";

interface AdminDependencies {
  database: TcwDatabase;
  config: AppConfig;
  tournamentService: TournamentService;
  matchesImporter: MatchesImporter;
  agendaImporter: AgendaImporter;
}

function parseId(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`Ungültige ${label}.`);
  }
  return Number(value);
}

export function registerAdminRoutes(app: FastifyInstance, deps: AdminDependencies): void {
  const { database, config } = deps;
  const timeout = config.swisstennisTimeoutMs;

  // ----- Teams -----
  app.get("/api/teams", async () => ({ items: listTeams(database) }));
  app.post("/api/teams", async (request, reply) => {
    createTeam(database, request.body as Record<string, unknown>);
    return reply.code(201).send({ ok: true });
  });
  app.put("/api/teams/:id", async (request) => {
    updateTeam(database, parseId((request.params as { id: string }).id, "Team-ID"), request.body as Record<string, unknown>);
    return { ok: true };
  });
  app.delete("/api/teams/:id", async (request) => {
    deleteTeam(database, parseId((request.params as { id: string }).id, "Team-ID"));
    return { ok: true };
  });

  // ----- Spieler -----
  app.get("/api/players", async () => ({ items: listPlayers(database) }));
  app.post("/api/players", async (request, reply) => {
    await createPlayer(database, request.body as Record<string, unknown>, timeout);
    return reply.code(201).send({ ok: true });
  });
  app.put("/api/players/:id", async (request) => {
    await updatePlayer(database, parseId((request.params as { id: string }).id, "Spieler-ID"), request.body as Record<string, unknown>, timeout);
    return { ok: true };
  });
  app.delete("/api/players/:id", async (request) => {
    deletePlayer(database, parseId((request.params as { id: string }).id, "Spieler-ID"));
    return { ok: true };
  });

  // ----- Trainingsslots -----
  app.get("/api/training-slots", async () => ({ items: listTrainingSlots(database) }));
  app.post("/api/training-slots/bulk", async (request) => {
    const body = request.body as { items?: unknown };
    saveTrainingGrid(database, (body.items ?? []) as never);
    return { ok: true };
  });

  // ----- Klassierungsänderungen -----
  app.get("/api/ranking-changes", async () => ({ items: listRankingChanges(database) }));
  app.put("/api/ranking-changes/:id", async (request) => {
    updateRankingChange(database, parseId((request.params as { id: string }).id, "Änderungs-ID"), request.body as Record<string, unknown>);
    return { ok: true };
  });
  app.delete("/api/ranking-changes/:id", async (request) => {
    deleteRankingChange(database, parseId((request.params as { id: string }).id, "Änderungs-ID"));
    return { ok: true };
  });

  // ----- Turniere -----
  app.get("/api/tournaments", async () => ({ items: listAdminTournaments(database) }));
  app.post("/api/tournaments", async (request) => {
    const body = request.body as { items?: unknown };
    saveTournaments(database, body.items);
    return { ok: true };
  });
  app.post("/api/tournaments/:id/refresh", async (request) => {
    const tournamentId = parseId((request.params as { id: string }).id, "Turnier-ID");
    const tournamentConfig = listAdminTournaments(database).find(
      (tournament) => tournament.swisstennisTournamentId === tournamentId,
    );
    if (!tournamentConfig) {
      throw new ValidationError("Turnier nicht gefunden.");
    }
    const result = await deps.tournamentService.refresh(
      {
        id: tournamentConfig.id,
        name: tournamentConfig.name,
        swisstennisTournamentId: tournamentConfig.swisstennisTournamentId,
        registrationUrl: tournamentConfig.registrationUrl,
        active: tournamentConfig.active,
        sortOrder: tournamentConfig.sortOrder,
      },
      { resolvePlayerUrls: true },
    );
    return { ok: true, result };
  });

  // ----- Aktionen -----
  app.post("/api/actions/update-klassierung", async () => {
    const summary = await updateKlassierungenFromMyTennis(database, timeout);
    const lines = summary.changes.map(
      (change) => `${change.playerName}: ${change.oldKlassierung || "-"} -> ${change.newKlassierung}`,
    );
    lines.push(
      `Fertig. Aktualisiert: ${summary.updated}, Unverändert: ${summary.unchanged}, Übersprungen: ${summary.skipped}`,
    );
    return { ok: true, output: lines.join("\n"), summary };
  });
  app.post("/api/actions/import-matches", async () => {
    const count = await deps.matchesImporter.importMatches();
    return { ok: true, count };
  });
  app.post("/api/actions/import-agenda", async () => {
    const count = await deps.agendaImporter.importAgenda();
    return { ok: true, count };
  });
}
