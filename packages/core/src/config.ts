/**
 * Laufzeitkonfiguration aus Umgebungsvariablen mit sicheren Defaults.
 *
 * Pfade werden relativ zum Repository-Wurzelverzeichnis aufgelöst, damit die
 * Konfiguration unabhängig vom aktuellen Arbeitsverzeichnis (cwd) funktioniert.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Umgebungsvariable ${name} muss eine Zahl sein, war: "${raw}".`);
  }
  return value;
}

function readPath(name: string, fallbackRelative: string): string {
  const raw = process.env[name];
  if (raw && raw.trim() !== "") {
    return resolve(raw);
  }
  return resolve(REPO_ROOT, fallbackRelative);
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return raw === "true" || raw === "1" || raw === "yes";
}

export interface AppConfig {
  repoRoot: string;
  dataDir: string;
  dbFilePath: string;
  i18nDir: string;
  publicPort: number;
  adminPort: number;
  publicHost: string;
  adminHost: string;
  swisstennisTimeoutMs: number;
  swisstennisCacheTtlSeconds: number;
  /** Cache-TTL der IC-Ergebnisse (Begegnungen/Teams): bewusst lang, da Resultate stabil sind. */
  resultsCacheTtlSeconds: number;
  enableBackgroundJobs: boolean;
  resolvePlayerUrls: boolean;
  /** Optionale Basic-Auth für den Admin-Server (leer = keine Auth, nur lokal). */
  adminUser: string;
  adminPassword: string;
}

export function loadConfig(): AppConfig {
  const dataDir = readPath("IC_DATA_DIR", "data");
  return {
    repoRoot: REPO_ROOT,
    dataDir,
    dbFilePath: readPath("IC_DB_PATH", "data/ic_teams.sqlite"),
    i18nDir: readPath("IC_I18N_DIR", "data/i18n"),
    publicPort: readNumber("IC_PUBLIC_PORT", 8090),
    adminPort: readNumber("IC_ADMIN_PORT", 8091),
    publicHost: process.env.IC_PUBLIC_HOST?.trim() || "0.0.0.0",
    adminHost: process.env.IC_ADMIN_HOST?.trim() || "127.0.0.1",
    swisstennisTimeoutMs: readNumber("IC_SWISSTENNIS_TIMEOUT_MS", 20_000),
    swisstennisCacheTtlSeconds: readNumber("IC_SWISSTENNIS_CACHE_TTL", 7_200),
    // IC-Ergebnisse werden nur einmal täglich neu von Swisstennis geladen (86400 s).
    resultsCacheTtlSeconds: readNumber("IC_RESULTS_CACHE_TTL", 86_400),
    enableBackgroundJobs: readBoolean("IC_ENABLE_JOBS", true),
    // Link-Auflösung standardmäßig aus (schont MyTennis); in Produktion aktivierbar.
    resolvePlayerUrls: readBoolean("IC_RESOLVE_PLAYER_URLS", false),
    adminUser: process.env.IC_ADMIN_USER?.trim() ?? "",
    adminPassword: process.env.IC_ADMIN_PASSWORD ?? "",
  };
}
