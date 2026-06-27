/**
 * URL-Bildung für die Swisstennis-Wettbewerbs-Endpunkte.
 *
 * Beide Wettbewerbe nutzen dieselben Servlets, nur mit eigenem Pfad-Präfix:
 * Interclub `/ic.../`, Team-Challenge `/hic.../`. Das laufende Jahr nutzt den
 * Pfad ohne Jahr (`/ic/`), Vorjahre mit Jahr (`/ic{YYYY}/`).
 */
import { OWN_CLUB_ID, type ResultType } from "@tcw/shared";

const BASE = "https://comp.swisstennis.ch";

function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Normalisiert eine Jahresangabe auf eine 4-stellige Zahl oder das aktuelle Jahr. */
export function normalizeYear(year: string | undefined): string {
  const trimmed = (year ?? "").trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : currentYear();
}

/** Jahres-Suffix für den Servlet-Pfad: leer für das laufende Jahr. */
export function yearSuffix(year: string | undefined): string {
  const normalized = normalizeYear(year);
  return normalized === currentYear() ? "" : normalized;
}

function servlet(competition: string, year: string | undefined, path: string): string {
  return `${BASE}/${competition}${yearSuffix(year)}/servlet/${path}`;
}

export function entryPageUrl(competition: string, year: string | undefined): string {
  return servlet(competition, year, `EntryPage?ClubName=${OWN_CLUB_ID}&outputFormat=JSON`);
}

export function clubResultUrl(competition: string, year: string | undefined): string {
  return servlet(competition, year, `ClubResult?ClubName=${OWN_CLUB_ID}&Lang=de&outputFormat=JSON`);
}

/** DrawResults nach EncountId (für Playoff-Metadaten der Spieltermine). */
export function drawMetaByEncountUrl(competition: string, encountId: number, year: string | undefined): string {
  return servlet(competition, year, `DrawResults?EncountId=${encountId}&Lang=D&outputFormat=JSON`);
}

export function teamResultsUrl(competition: string, teamId: number, year: string | undefined): string {
  return servlet(competition, year, `TeamResults?TeamId=${teamId}&Lang=de&outputFormat=JSON`);
}

export function encountResultsUrl(
  competition: string,
  encountId: number,
  year: string | undefined,
  type: ResultType,
): string {
  const servletName = type === "tableau" ? "TableauResults" : "EncountResults";
  return servlet(competition, year, `${servletName}?EncountId=${encountId}&Lang=de&outputFormat=JSON`);
}

export function drawResultsUrl(
  competition: string,
  ligueId: number,
  promotion: 0 | 1,
  year: string | undefined,
): string {
  return servlet(
    competition,
    year,
    `DrawResults?LigueId=${ligueId}&Promotion=${promotion}&Lang=de&outputFormat=JSON`,
  );
}
