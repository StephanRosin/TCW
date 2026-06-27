/**
 * Migrations- und Seed-Skript des TCW Spielbetriebs.
 *
 * Aufgaben (alle idempotent, niemals destruktiv):
 *  1. Backup der Zieldatenbank, falls vorhanden.
 *  2. Schema sicherstellen.
 *  3. Teams/Spieler/Trainingsslots/Klassierungsänderungen aus der bestehenden
 *     SQLite-Datenbank übernehmen; falls dort leer, aus den Seed-Dateien.
 *  4. Turnierkonfiguration mit den bekannten Standardturnieren versorgen.
 *  5. Beispiel-Spieltermine für lokale Tests laden, falls noch keine vorhanden.
 *
 * Bestehende Daten werden nie überschrieben: Jeder Seed-Schritt prüft zuerst,
 * ob die Zieltabelle bereits befüllt ist.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { loadConfig, openDatabase, type TcwDatabase } from "@tcw/core";
import { cleanPlayerName } from "@tcw/shared";

const config = loadConfig();
const LEGACY_DB_PATH = resolve(config.repoRoot, "data/seeds/ic_teams.legacy.sqlite");
const TEAMS_SEED_PATH = resolve(config.repoRoot, "data/seeds/teams_seed.json");
const MATCHES_SAMPLE_PATH = resolve(config.repoRoot, "data/seeds/matches.sample.json");
const BACKUP_DIR = resolve(config.repoRoot, "data/backups");

const DEFAULT_TOURNAMENTS = [
  { name: "Waidcup", swisstennisTournamentId: 158138, sortOrder: 0 },
  { name: "Clubmeisterschaft", swisstennisTournamentId: 158133, sortOrder: 1 },
] as const;

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupExistingDatabase(): void {
  if (!existsSync(config.dbFilePath)) {
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const target = resolve(BACKUP_DIR, `ic_teams_${timestamp()}.sqlite`);
  copyFileSync(config.dbFilePath, target);
  console.log(`Backup der bestehenden Datenbank: ${target}`);
}

function tableExists(database: Database.Database, tableName: string): boolean {
  const row = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return row !== undefined;
}

function countRows(database: TcwDatabase, tableName: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS total FROM ${tableName}`).get() as {
    total: number;
  };
  return row.total;
}

interface LegacyTeamRow {
  id: number;
  gender: string;
  category: string;
  liga: string;
  teamziel: string | null;
  trainingstag: string | null;
}

interface SeedPlayer {
  name: string;
  captain_status: number;
}

interface SeedTeam {
  name: string;
  gender: string;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
  players: SeedPlayer[];
}

function importTeamsFromLegacy(target: TcwDatabase, legacy: Database.Database): boolean {
  if (!tableExists(legacy, "teams") || (legacy.prepare("SELECT COUNT(*) AS total FROM teams").get() as { total: number }).total === 0) {
    return false;
  }
  const teams = legacy.prepare("SELECT * FROM teams").all() as LegacyTeamRow[];
  const insertTeam = target.prepare(
    `INSERT INTO teams (id, gender, category, liga, teamziel, trainingstag)
     VALUES (@id, @gender, @category, @liga, @teamziel, @trainingstag)`,
  );
  const hasPlayers = tableExists(legacy, "players");
  const players = hasPlayers
    ? (legacy.prepare("SELECT * FROM players").all() as Array<Record<string, unknown>>)
    : [];
  const insertPlayer = target.prepare(
    `INSERT INTO players (id, name, klassierung, myTennisID, team_id, captain_status)
     VALUES (@id, @name, @klassierung, @myTennisID, @team_id, @captain_status)`,
  );

  const run = target.transaction(() => {
    for (const team of teams) {
      insertTeam.run({
        id: team.id,
        gender: team.gender,
        category: team.category,
        liga: team.liga,
        teamziel: team.teamziel ?? "",
        trainingstag: team.trainingstag ?? "",
      });
    }
    for (const player of players) {
      insertPlayer.run({
        id: player.id,
        name: cleanPlayerName(String(player.name ?? "")),
        klassierung: String(player.klassierung ?? ""),
        myTennisID: String(player.myTennisID ?? ""),
        team_id: player.team_id ?? null,
        captain_status: Number(player.captain_status ?? 0),
      });
    }
  });
  run();
  console.log(`Aus Legacy-DB übernommen: ${teams.length} Teams, ${players.length} Spieler.`);
  return true;
}

function importTeamsFromSeed(target: TcwDatabase): void {
  const seed = JSON.parse(readFileSync(TEAMS_SEED_PATH, "utf8")) as { teams: SeedTeam[] };
  const insertTeam = target.prepare(
    `INSERT INTO teams (gender, category, liga, teamziel, trainingstag)
     VALUES (@gender, @category, @liga, @teamziel, @trainingstag)`,
  );
  const insertPlayer = target.prepare(
    `INSERT INTO players (name, klassierung, myTennisID, team_id, captain_status)
     VALUES (@name, '', '', @team_id, @captain_status)`,
  );

  const run = target.transaction(() => {
    for (const team of seed.teams) {
      const result = insertTeam.run({
        gender: team.gender,
        category: team.category,
        liga: team.liga,
        teamziel: team.teamziel,
        trainingstag: team.trainingstag,
      });
      const teamId = Number(result.lastInsertRowid);
      for (const player of team.players) {
        insertPlayer.run({
          name: cleanPlayerName(player.name),
          team_id: teamId,
          captain_status: player.captain_status,
        });
      }
    }
  });
  run();
  const teamCount = seed.teams.length;
  const playerCount = seed.teams.reduce((sum, team) => sum + team.players.length, 0);
  console.log(`Aus Seed übernommen: ${teamCount} Teams, ${playerCount} Spieler.`);
}

function teamDisplayKey(gender: string, category: string, liga: string): string {
  return `${gender} ${category} ${liga}`.replace(/\s+/g, "").toLowerCase();
}

interface TrainingSeedSlot {
  day: string;
  time_from: string;
  time_to: string;
  court_number: number;
  team_title?: string;
  label?: string;
}

/** Trainingsslots aus dem Bestand übernehmen oder aus dem statischen Wochenplan seeden. */
function importTrainingSlots(target: TcwDatabase, legacy: Database.Database): void {
  if (countRows(target, "training_slots") > 0) {
    return;
  }
  if (
    tableExists(legacy, "training_slots") &&
    (legacy.prepare("SELECT COUNT(*) AS total FROM training_slots").get() as { total: number }).total > 0
  ) {
    const rows = legacy.prepare("SELECT * FROM training_slots").all() as Array<Record<string, unknown>>;
    const insert = target.prepare(
      `INSERT INTO training_slots (day, time_from, time_to, court_number, team_id, label_override)
       VALUES (@day, @time_from, @time_to, @court_number, @team_id, @label_override)`,
    );
    target.transaction(() => {
      for (const row of rows) {
        insert.run({
          day: row.day,
          time_from: row.time_from,
          time_to: row.time_to,
          court_number: row.court_number,
          team_id: row.team_id ?? null,
          label_override: row.label_override ?? "",
        });
      }
    })();
    console.log(`Aus Legacy-DB übernommen: ${rows.length} Trainingsslots.`);
    return;
  }

  const slots = JSON.parse(readFileSync(resolve(config.repoRoot, "data/seeds/training_slots.json"), "utf8")) as TrainingSeedSlot[];
  const teamRows = target.prepare("SELECT id, gender, category, liga FROM teams").all() as Array<{
    id: number;
    gender: string;
    category: string;
    liga: string;
  }>;
  const teamByDisplay = new Map<string, number>();
  for (const team of teamRows) {
    teamByDisplay.set(teamDisplayKey(team.gender, team.category, team.liga), team.id);
  }
  const insert = target.prepare(
    `INSERT OR IGNORE INTO training_slots (day, time_from, time_to, court_number, team_id, label_override)
     VALUES (@day, @time_from, @time_to, @court_number, @team_id, @label_override)`,
  );
  target.transaction(() => {
    for (const slot of slots) {
      const teamId = slot.team_title
        ? teamByDisplay.get(slot.team_title.replace(/\s+/g, "").toLowerCase()) ?? null
        : null;
      const labelOverride = teamId ? "" : slot.team_title ?? slot.label ?? "";
      insert.run({
        day: slot.day,
        time_from: slot.time_from,
        time_to: slot.time_to,
        court_number: slot.court_number,
        team_id: teamId,
        label_override: labelOverride,
      });
    }
  })();
  console.log(`Aus Seed übernommen: ${slots.length} Trainingsslots.`);
}

function importRankingChanges(target: TcwDatabase, legacy: Database.Database): void {
  if (countRows(target, "ranking_changes") > 0 || !tableExists(legacy, "ranking_changes")) {
    return;
  }
  const rows = legacy.prepare("SELECT * FROM ranking_changes").all() as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return;
  }
  const insert = target.prepare(
    `INSERT INTO ranking_changes (id, player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at)
     VALUES (@id, @player_id, @player_name, @myTennisID, @old_klassierung, @new_klassierung, @changed_at)`,
  );
  target.transaction(() => {
    for (const row of rows) {
      insert.run({
        id: row.id,
        player_id: row.player_id,
        player_name: row.player_name,
        myTennisID: row.myTennisID ?? "",
        old_klassierung: row.old_klassierung ?? "",
        new_klassierung: row.new_klassierung ?? "",
        changed_at: row.changed_at ?? "",
      });
    }
  })();
  console.log(`Aus Legacy-DB übernommen: ${rows.length} Klassierungsänderungen.`);
}

function seedTournaments(target: TcwDatabase): void {
  const insert = target.prepare(
    `INSERT OR IGNORE INTO tournaments (name, swisstennis_tournament_id, registration_url, active, sort_order)
     VALUES (@name, @id, @url, 1, @sortOrder)`,
  );
  for (const tournament of DEFAULT_TOURNAMENTS) {
    insert.run({
      name: tournament.name,
      id: tournament.swisstennisTournamentId,
      url: `https://www.mytennis.ch/de/turniere/${tournament.swisstennisTournamentId}`,
      sortOrder: tournament.sortOrder,
    });
  }
  console.log(`Turnierkonfiguration sichergestellt (${countRows(target, "tournaments")} Turniere).`);
}

interface SampleMatch {
  runde?: string;
  date?: string;
  time?: string;
  liga?: string;
  home?: string;
  away?: string;
  result?: string;
  encountId?: number;
  validated?: number;
  year?: string;
  home_is_own?: number;
  playoff?: number;
  playoff_type?: string;
  playoff_title?: string;
  playoff_ligue_id?: number;
}

/** Lädt die Beispiel-Spieltermine, damit die App lokal ohne Live-Import Daten zeigt. */
function importSampleMatches(target: TcwDatabase): void {
  if (countRows(target, "matches") > 0 || !existsSync(MATCHES_SAMPLE_PATH)) {
    return;
  }
  const payload = JSON.parse(readFileSync(MATCHES_SAMPLE_PATH, "utf8")) as {
    updated_at?: string;
    year?: string;
    source?: string;
    matches?: SampleMatch[];
  };
  const matches = payload.matches ?? [];
  const insert = target.prepare(
    `INSERT INTO matches (year, round, date, time, liga, home, away, result, encount_id, validated, is_home_own, playoff, playoff_type, playoff_title, playoff_ligue_id, sort_index)
     VALUES (@year, @round, @date, @time, @liga, @home, @away, @result, @encount_id, @validated, @is_home_own, @playoff, @playoff_type, @playoff_title, @playoff_ligue_id, @sort_index)`,
  );
  const fallbackYear = payload.year ?? String(new Date().getFullYear());
  target.transaction(() => {
    matches.forEach((match, index) => {
      insert.run({
        year: match.year ?? fallbackYear,
        round: match.runde ?? "",
        date: match.date ?? "",
        time: match.time ?? "",
        liga: match.liga ?? "",
        home: match.home ?? "",
        away: match.away ?? "",
        result: match.result ?? "",
        encount_id: match.encountId ?? 0,
        validated: match.validated ?? 0,
        is_home_own: match.home_is_own ?? 0,
        playoff: match.playoff ?? 0,
        playoff_type: match.playoff_type ?? "",
        playoff_title: match.playoff_title ?? "",
        playoff_ligue_id: match.playoff_ligue_id ?? 0,
        sort_index: index,
      });
    });
  })();
  target
    .prepare(
      `INSERT INTO import_state (key, updated_at, source, last_run_at, last_error)
       VALUES ('matches', @updated_at, @source, @now, '')
       ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, source = excluded.source, last_run_at = excluded.last_run_at`,
    )
    .run({
      updated_at: payload.updated_at ?? "",
      source: payload.source ?? "sample",
      now: new Date().toISOString(),
    });
  console.log(`Beispiel-Spieltermine geladen: ${matches.length} Einträge.`);
}

function main(): void {
  console.log(`Zieldatenbank: ${config.dbFilePath}`);
  backupExistingDatabase();
  const target = openDatabase({ filePath: config.dbFilePath });
  const legacy = existsSync(LEGACY_DB_PATH)
    ? new Database(LEGACY_DB_PATH, { readonly: true })
    : null;

  if (countRows(target, "teams") === 0) {
    const importedFromLegacy = legacy ? importTeamsFromLegacy(target, legacy) : false;
    if (!importedFromLegacy) {
      importTeamsFromSeed(target);
    }
  } else {
    console.log("Teams bereits vorhanden – kein erneutes Seeding.");
  }

  if (legacy) {
    importTrainingSlots(target, legacy);
    importRankingChanges(target, legacy);
  } else {
    importTrainingSlots(target, new Database(":memory:"));
  }
  seedTournaments(target);
  importSampleMatches(target);

  legacy?.close();
  target.close();
  console.log("Migration abgeschlossen.");
}

main();
