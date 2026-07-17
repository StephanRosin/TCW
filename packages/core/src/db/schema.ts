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
  -- Klassierung und Profil-URL (myTennisID) liegen zentral im player_registry
  -- (Single Source of Truth); die früheren Spalten hier wurden in Phase 3 entfernt.
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
  -- Klassierung (ranking/ranking_2) liegt zentral im player_registry; die früheren
  -- Spalten hier wurden in Phase 3 entfernt (Werte kommen jetzt über den Registry-Join).
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
  -- Zeitpunkt, an dem zum ersten Mal ein Ergebnis erschien (~ Spieltag), als
  -- Datums-Ersatz für Partien ohne Termin (z. B. CM-Gruppenspiele). Einmal
  -- gesetzt, danach unverändert.
  result_seen_at TEXT,
  PRIMARY KEY (tournament_id, event_id, match_key)
);

-- Zusatzdaten je Turnier-Event: Round-robin-Tabelle und Tableau-Baum (als JSON).
CREATE TABLE IF NOT EXISTS tournament_event_extras (
  tournament_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  pools_json TEXT NOT NULL DEFAULT '[]',
  bracket_json TEXT,
  PRIMARY KEY (tournament_id, event_id)
);

-- Bezahlt-Tracking der Waidcup-Adminseite: je Person (person_key = registry_id
-- oder Namens-Schlüssel) ein Bezahlt-Flag. Rein admin-gepflegt, nicht aus dem
-- Import; überlebt Imports (eigene Tabelle).
CREATE TABLE IF NOT EXISTS waidcup_payments (
  tournament_id INTEGER NOT NULL,
  person_key TEXT NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  PRIMARY KEY (tournament_id, person_key)
);

-- Spielerzentrierte Einzel-/Doppelmatches (aktuelles Jahr), normalisiert über
-- alle Wettbewerbe (IC, TC, Waidcup, CM). Pro Beteiligtem ein reihenfolge-
-- unabhängiger Namens-Schlüssel (*_key) zum Suchen sowie die Profil-URL.
CREATE TABLE IF NOT EXISTS player_matches (
  match_uid TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  competition_code TEXT NOT NULL,
  competition_label TEXT NOT NULL,
  discipline TEXT NOT NULL,
  match_date TEXT,
  sort_key TEXT NOT NULL DEFAULT '',
  s1p1_name TEXT NOT NULL DEFAULT '', s1p1_key TEXT NOT NULL DEFAULT '', s1p1_url TEXT,
  s1p2_name TEXT NOT NULL DEFAULT '', s1p2_key TEXT NOT NULL DEFAULT '', s1p2_url TEXT,
  s2p1_name TEXT NOT NULL DEFAULT '', s2p1_key TEXT NOT NULL DEFAULT '', s2p1_url TEXT,
  s2p2_name TEXT NOT NULL DEFAULT '', s2p2_key TEXT NOT NULL DEFAULT '', s2p2_url TEXT,
  result TEXT NOT NULL DEFAULT '',
  winner_side INTEGER NOT NULL DEFAULT 0,
  match_url TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pm_s1p1 ON player_matches(s1p1_key);
CREATE INDEX IF NOT EXISTS idx_pm_s1p2 ON player_matches(s1p2_key);
CREATE INDEX IF NOT EXISTS idx_pm_s2p1 ON player_matches(s2p1_key);
CREATE INDEX IF NOT EXISTS idx_pm_s2p2 ON player_matches(s2p2_key);

-- Importzustand je Begegnung (IC/TC), damit nur neue/geänderte Begegnungen
-- erneut von Swisstennis geladen werden.
CREATE TABLE IF NOT EXISTS encounter_detail_state (
  competition_code TEXT NOT NULL,
  encount_id INTEGER NOT NULL,
  result_hash TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (competition_code, encount_id)
);

-- Zentrales Spieler-Register mit Klassierung, Lizenzierung und Verbandszugehörigkeit.
-- Dient als Single Source of Truth für Spielerprofil-Daten über alle Wettbewerbe.
CREATE TABLE IF NOT EXISTS player_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mytennis_id TEXT,
  name_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_url TEXT,
  klassierung TEXT,
  license_number TEXT,
  is_tcw_member INTEGER NOT NULL DEFAULT 0,
  member_source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_registry_mytennis ON player_registry(mytennis_id) WHERE mytennis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_registry_name_key ON player_registry(name_key);
CREATE INDEX IF NOT EXISTS idx_player_registry_member ON player_registry(is_tcw_member);
`;
