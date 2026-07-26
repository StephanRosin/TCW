/**
 * Laufzeitkonfiguration aus Umgebungsvariablen mit sicheren Defaults.
 *
 * Pfade werden relativ zum Repository-Wurzelverzeichnis aufgelöst, damit die
 * Konfiguration unabhängig vom aktuellen Arbeitsverzeichnis (cwd) funktioniert.
 */
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

let dotEnvLoaded = false;

/**
 * Lädt `.env` aus dem Repo-Wurzelverzeichnis in process.env (nur fehlende
 * Schlüssel). Hält Secrets wie GotCourts-Zugangsdaten aus dem Code/Repo heraus
 * (.env ist gitignored). Einmal pro Prozess.
 */
function loadDotEnv(): void {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;
  const envPath = resolve(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Umgebungsvariable ${name} muss eine Zahl sein, war: "${raw}".`);
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
  /** GotCourts-Zugangsdaten für die Platzbelegung (leer = Funktion deaktiviert). */
  gotcourtsEmail: string;
  gotcourtsPassword: string;
  gotcourtsClubId: number;
  gotcourtsTimeoutMs: number;
  /** Waidcup-Website: Port und angezeigtes Turnier (Test-ID einsetzbar). */
  waidcupPort: number;
  waidcupHost: string;
  waidcupTournamentId: number;
  /** Passwort der Waidcup-Adminseite (leer = Adminseite deaktiviert). Nur Server-Env. */
  waidcupAdminPassword: string;
  /** Pfad zur SQLite-DB der CM-Platz-App (bestätigte CM-Termine; leer = aus). */
  cmPlatzDbPath: string;
  /** Wurzel der Waidcup-Fotogalerie (<jahr>/<tag>/{thumb,large}); fehlt sie, bleibt der Tab leer. */
  waidcupGalleryDir: string;
}

export function loadConfig(): AppConfig {
  loadDotEnv();
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
    gotcourtsEmail: process.env.GC_EMAIL?.trim() ?? "",
    gotcourtsPassword: process.env.GC_PASSWORD ?? "",
    gotcourtsClubId: readNumber("GC_CLUB_ID", 193),
    gotcourtsTimeoutMs: readNumber("GC_TIMEOUT_SECONDS", 20) * 1000,
    waidcupPort: readNumber("IC_WAIDCUP_PORT", 8096),
    waidcupHost: process.env.IC_WAIDCUP_HOST?.trim() || "0.0.0.0",
    waidcupTournamentId: readNumber("WAIDCUP_TOURNAMENT_ID", 158138),
    waidcupAdminPassword: process.env.WAIDCUP_ADMIN_PASSWORD ?? "",
    cmPlatzDbPath: process.env.CM_PLATZ_DB_PATH?.trim() ?? "",
    waidcupGalleryDir: readPath("WAIDCUP_GALLERY_DIR", `${process.env.HOME ?? "."}/waidcup-gallery`),
  };
}
