/**
 * Vollständiges SQLite-Schema des TCW Spielbetriebs.
 *
 * Das Schema ist abwärtskompatibel zum bestehenden `ic_teams.sqlite`
 * (Tabellen teams, players, training_slots, ranking_changes) und ergänzt die
 * nativ integrierten Turnier- sowie Import-/Cache-Tabellen.
 *
 * Alle Anweisungen sind idempotent (CREATE TABLE IF NOT EXISTS), damit das
 * Schema beim Start sicher angewendet werden kann, ohne Daten zu verlieren.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gender TEXT NOT NULL,
  category TEXT NOT NULL,
  liga TEXT NOT NULL,
  teamziel TEXT NOT NULL DEFAULT '',
  trainingstag TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  klassierung TEXT NOT NULL DEFAULT '',
  myTennisID TEXT NOT NULL DEFAULT '',
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  captain_status INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  court_number INTEGER NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  label_override TEXT NOT NULL DEFAULT '',
  UNIQUE(day, time_from, time_to, court_number)
);

CREATE TABLE IF NOT EXISTS ranking_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  myTennisID TEXT NOT NULL DEFAULT '',
  old_klassierung TEXT NOT NULL DEFAULT '',
  new_klassierung TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Importierte Spieltermine (ClubResult). Re-Import ersetzt pro Jahr atomar.
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year TEXT NOT NULL,
  round TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  liga TEXT NOT NULL DEFAULT '',
  home TEXT NOT NULL DEFAULT '',
  away TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  encount_id INTEGER NOT NULL DEFAULT 0,
  validated INTEGER NOT NULL DEFAULT 0,
  is_home_own INTEGER NOT NULL DEFAULT 0,
  playoff INTEGER NOT NULL DEFAULT 0,
  playoff_type TEXT NOT NULL DEFAULT '',
  playoff_title TEXT NOT NULL DEFAULT '',
  playoff_ligue_id INTEGER NOT NULL DEFAULT 0,
  sort_index INTEGER NOT NULL DEFAULT 0
);

-- Zustand der wiederkehrenden Importe (Stand, Quelle, letzter Fehler).
CREATE TABLE IF NOT EXISTS import_state (
  key TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  last_run_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT ''
);

-- Schlüssel/Wert-Einstellungen der öffentlichen Seite (z. B. Sichtbarkeit von Tabs).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Vereins-Agenda (täglich von tcwaidberg.ch importiert).
CREATE TABLE IF NOT EXISTS agenda_events (
  event_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_full_day INTEGER NOT NULL DEFAULT 0,
  date_label TEXT NOT NULL,
  registration_label TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  detail_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Persistenter Cache externer Swisstennis-Antworten (TTL + Stale-Fallback).
CREATE TABLE IF NOT EXISTS swisstennis_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- Native Turnierkonfiguration (ersetzt die frühere Waidcup-Abhängigkeit).
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  swisstennis_tournament_id INTEGER UNIQUE NOT NULL,
  registration_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_imported_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournament_events (
  tournament_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  tournament_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  discipline TEXT NOT NULL DEFAULT '',
  source_descr TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tournament_id, event_id)
);

CREATE TABLE IF NOT EXISTS tournament_players (
  tournament_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  player_key TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_name_2 TEXT,
  license_number TEXT,
  license_number_2 TEXT,
  player_url TEXT,
  player_url_2 TEXT,
  confirmed INTEGER NOT NULL DEFAULT 0,
  ranking TEXT,
  ranking_2 TEXT,
  registered_on TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tournament_id, event_id, player_key),
  FOREIGN KEY (tournament_id, event_id)
    REFERENCES tournament_events(tournament_id, event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  tournament_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  match_key TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  pool_name TEXT,
  round_name TEXT,
  scheduled_date TEXT,
  scheduled_time TEXT,
  court TEXT,
  player1_name TEXT NOT NULL,
  player1_name_2 TEXT,
  player2_name TEXT NOT NULL,
  player2_name_2 TEXT,
  result TEXT,
  status TEXT NOT NULL,
  winner_side INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tournament_id, event_id, match_key)
);
`;
