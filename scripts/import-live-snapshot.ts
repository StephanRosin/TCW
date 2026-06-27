/**
 * Spielt einen read-only vom Livesystem gezogenen Datensnapshot in die lokale
 * Datenbank ein (für realitätsnahe Tests). Quelle sind die als JSON in
 * `data/seeds/live_*.json` abgelegten Antworten der Live-Admin-/Public-API.
 *
 * Ersetzt ausschließlich die inhaltlichen Tabellen (Teams, Spieler,
 * Trainingsslots, Klassierungsänderungen, Spieltermine). Turnierkonfiguration
 * und Cache bleiben unberührt. Erstellt vor dem Schreiben ein Backup.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, openDatabase, type TcwDatabase } from "@tcw/core";
import { cleanPlayerName } from "@tcw/shared";

const config = loadConfig();
const SEED_DIR = resolve(config.repoRoot, "data/seeds");
const BACKUP_DIR = resolve(config.repoRoot, "data/backups");

function readSnapshot<TItem>(fileName: string): TItem[] {
  const payload = JSON.parse(readFileSync(resolve(SEED_DIR, fileName), "utf8")) as {
    items?: TItem[];
  };
  return payload.items ?? [];
}

function backup(): void {
  if (!existsSync(config.dbFilePath)) {
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const target = resolve(BACKUP_DIR, `ic_teams_${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
  copyFileSync(config.dbFilePath, target);
  console.log(`Backup: ${target}`);
}

interface TeamItem {
  id: number;
  gender: string;
  category: string;
  liga: string;
  teamziel: string;
  trainingstag: string;
}
interface PlayerItem {
  id: number;
  name: string;
  klassierung: string;
  myTennisID: string;
  team_id: number;
  captain_status: number;
}
interface TrainingItem {
  id: number;
  day: string;
  time_from: string;
  time_to: string;
  court_number: number;
  team_id: number | null;
  label_override: string;
}
interface RankingItem {
  id: number;
  player_id: number;
  player_name: string;
  myTennisID: string;
  old_klassierung: string;
  new_klassierung: string;
  changed_at: string;
}
interface MatchItem {
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

function importContent(database: TcwDatabase): void {
  const teams = readSnapshot<TeamItem>("live_teams.json");
  const players = readSnapshot<PlayerItem>("live_players.json");
  const training = readSnapshot<TrainingItem>("live_training.json");
  const ranking = readSnapshot<RankingItem>("live_ranking.json");
  const matchesPayload = JSON.parse(readFileSync(resolve(SEED_DIR, "live_matches.json"), "utf8")) as {
    updated_at?: string;
    source?: string;
    year?: string;
    matches?: MatchItem[];
  };
  const matches = matchesPayload.matches ?? [];

  const replaceAll = database.transaction(() => {
    for (const table of ["ranking_changes", "training_slots", "players", "teams", "matches"]) {
      database.prepare(`DELETE FROM ${table}`).run();
    }

    const insertTeam = database.prepare(
      `INSERT INTO teams (id, gender, category, liga, teamziel, trainingstag)
       VALUES (@id, @gender, @category, @liga, @teamziel, @trainingstag)`,
    );
    for (const team of teams) {
      insertTeam.run(team);
    }

    const insertPlayer = database.prepare(
      `INSERT INTO players (id, name, klassierung, myTennisID, team_id, captain_status)
       VALUES (@id, @name, @klassierung, @myTennisID, @team_id, @captain_status)`,
    );
    for (const player of players) {
      insertPlayer.run({ ...player, name: cleanPlayerName(player.name) });
    }

    const insertTraining = database.prepare(
      `INSERT INTO training_slots (id, day, time_from, time_to, court_number, team_id, label_override)
       VALUES (@id, @day, @time_from, @time_to, @court_number, @team_id, @label_override)`,
    );
    for (const slot of training) {
      insertTraining.run({ ...slot, label_override: slot.label_override ?? "" });
    }

    const insertRanking = database.prepare(
      `INSERT INTO ranking_changes (id, player_id, player_name, myTennisID, old_klassierung, new_klassierung, changed_at)
       VALUES (@id, @player_id, @player_name, @myTennisID, @old_klassierung, @new_klassierung, @changed_at)`,
    );
    for (const change of ranking) {
      insertRanking.run(change);
    }

    const insertMatch = database.prepare(
      `INSERT INTO matches (year, round, date, time, liga, home, away, result, encount_id, validated, is_home_own, playoff, playoff_type, playoff_title, playoff_ligue_id, sort_index)
       VALUES (@year, @round, @date, @time, @liga, @home, @away, @result, @encount_id, @validated, @is_home_own, @playoff, @playoff_type, @playoff_title, @playoff_ligue_id, @sort_index)`,
    );
    const fallbackYear = matchesPayload.year ?? String(new Date().getFullYear());
    matches.forEach((match, index) => {
      insertMatch.run({
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

    database
      .prepare(
        `INSERT INTO import_state (key, updated_at, source, last_run_at, last_error)
         VALUES ('matches', @updated_at, @source, @now, '')
         ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, source = excluded.source, last_run_at = excluded.last_run_at`,
      )
      .run({
        updated_at: matchesPayload.updated_at ?? "",
        source: matchesPayload.source ?? "clubresult-json",
        now: new Date().toISOString(),
      });
  });

  replaceAll();
  console.log(
    `Importiert: ${teams.length} Teams, ${players.length} Spieler, ${training.length} Trainingsslots, ${ranking.length} Klassierungsänderungen, ${matches.length} Spieltermine.`,
  );
}

function main(): void {
  backup();
  const database = openDatabase({ filePath: config.dbFilePath });
  importContent(database);
  database.close();
  console.log("Live-Snapshot eingespielt.");
}

main();
