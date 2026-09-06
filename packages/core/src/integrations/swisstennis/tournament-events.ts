/**
 * `/tournaments/info` → Turniername und Kategorienliste mit Spielform.
 *
 * Die Spielform steht bei der neuen Schnittstelle nicht mehr in einem eigenen
 * Feld, sondern nur im verlinkten PDF (`DisplayDraw.pdf` bzw.
 * `DisplayPools.pdf`) – und im Kategoriennamen, den sie mitliefert.
 */
import { disciplineOf } from "@tcw/shared";
import { cleanText, toNumber } from "./normalize.js";

export interface TournamentEventMeta {
  eventId: number;
  eventName: string;
  discipline: string;
  mode: string;
  isDouble: boolean;
  sortOrder: number;
}

export interface TournamentMeta {
  tournamentName: string;
  events: TournamentEventMeta[];
  /** Turnierzeitraum im API-Format M/T/JJJJ, für den Spielplan. */
  startTime: string;
  endTime: string;
}

interface RawCategory {
  eventId?: number;
  competition?: string;
  pdfUrl?: string;
}

const DOUBLE_DISCIPLINES = new Set(["MD", "WD", "DM"]);

/**
 * Der Kategoriename der API trägt die Spielform am Ende ("… Round Robin",
 * "… Tableau"). Sie fliegt raus, damit die Anzeige dieselbe bleibt wie zu
 * Zeiten der alten Schnittstelle, wo sie aus eigenen Feldern kam. Ein
 * nummeriertes Tableau ("Tableau 2") bleibt stehen – sonst wären mehrere
 * Kategorien nicht mehr auseinanderzuhalten.
 */
export function buildEventName(category: RawCategory): string {
  const raw = cleanText(category.competition ?? "");
  const numbered = /\bTableau\s+\d+\b/i.exec(raw);
  const base = raw.replace(/\s*(?:Round\s*Robin(?:\s+Finaltableau)?|Finaltableau|Tableau)\s*$/i, "");
  const name = cleanText(numbered ? `${base} ${numbered[0]}` : base);
  return name || `Event ${toNumber(category.eventId)}`;
}

export function mapTournamentMeta(payload: unknown): TournamentMeta {
  const tournament = payload as { name?: string; startTime?: string; endTime?: string; categories?: RawCategory[] } | null;
  if (!tournament || !Array.isArray(tournament.categories)) {
    throw new Error("Swisstennis-Turnierdaten sind unvollständig (keine Kategorien).");
  }

  const events: TournamentEventMeta[] = tournament.categories
    .map((category, index) => {
      const eventName = buildEventName(category);
      const discipline = disciplineOf(eventName);
      return {
        eventId: toNumber(category.eventId),
        eventName,
        discipline,
        mode: cleanText(category.pdfUrl ?? "").includes("DisplayPools") ? "Round-robin" : "Draw",
        isDouble: DOUBLE_DISCIPLINES.has(discipline),
        sortOrder: index,
      };
    })
    .filter((event) => event.eventId > 0);

  return {
    tournamentName: cleanText(tournament.name ?? "") || "Turnier",
    events,
    startTime: cleanText(tournament.startTime ?? ""),
    endTime: cleanText(tournament.endTime ?? ""),
  };
}
