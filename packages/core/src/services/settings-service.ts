/**
 * Einstellungen der öffentlichen Seite (Sichtbarkeit einzelner Tabs).
 *
 * Persistenz als Schlüssel/Wert-Paare in der `settings`-Tabelle. Fehlt ein
 * Schlüssel, gilt der Default (für dieses Jahr sind Trainingsplan und
 * Spieltermine ausgeblendet).
 */
import type { SiteSettings } from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

const SETTING_KEYS = {
  showTraining: "show_training",
  showMatches: "show_matches",
} as const;

const DEFAULTS: SiteSettings = {
  showTraining: false,
  showMatches: false,
};

interface SettingRow {
  value: string;
}

function readFlag(database: TcwDatabase, key: string, fallback: boolean): boolean {
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | SettingRow
    | undefined;
  return row ? row.value === "1" : fallback;
}

function writeFlag(database: TcwDatabase, key: string, value: boolean): void {
  database
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value ? "1" : "0");
}

export function getSiteSettings(database: TcwDatabase): SiteSettings {
  try {
    return {
      showTraining: readFlag(database, SETTING_KEYS.showTraining, DEFAULTS.showTraining),
      showMatches: readFlag(database, SETTING_KEYS.showMatches, DEFAULTS.showMatches),
    };
  } catch {
    // Tabelle evtl. noch nicht angelegt (z. B. readonly-Verbindung vor erster Migration).
    return { ...DEFAULTS };
  }
}

export function updateSiteSettings(
  database: TcwDatabase,
  patch: Partial<SiteSettings>,
): SiteSettings {
  if (patch.showTraining !== undefined) {
    writeFlag(database, SETTING_KEYS.showTraining, patch.showTraining === true);
  }
  if (patch.showMatches !== undefined) {
    writeFlag(database, SETTING_KEYS.showMatches, patch.showMatches === true);
  }
  return getSiteSettings(database);
}
