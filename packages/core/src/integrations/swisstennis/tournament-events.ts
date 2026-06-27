/**
 * TournamentDisplay → Turniername und Eventliste (Kategorien) mit Modus.
 */
import { disciplineOf } from "@tcw/shared";
import { asArray, cleanText, toNumber } from "./normalize.js";

export interface TournamentEventMeta {
  eventId: number;
  eventName: string;
  discipline: string;
  mode: string;
  matchTypeId: number;
  sortOrder: number;
}

export interface TournamentMeta {
  tournamentName: string;
  events: TournamentEventMeta[];
}

interface RawAgeCategory {
  AgeCategory?: { agcWomenDescr?: string; agcMenDescr?: string; agcMixtDescr?: string };
}
interface RawEvent {
  eventId?: number;
  evtDescr?: string;
  ioEventMode?: { IoEventMode?: { evmName?: string } };
  ioMatchType?: { IoMatchType?: { mtpName?: string; matchTypeId?: number } };
  ageCategoryEvtIdAgeCategory?: RawAgeCategory;
  rankingTypeEvtIdUpperRanking?: { RankingType?: { rnkDescr?: string } };
  rankingTypeEvtIdLowerRanking?: { RankingType?: { rnkDescr?: string } };
}

function ageCategoryFor(matchType: string, age: RawAgeCategory["AgeCategory"]): string {
  if (!age) return "";
  if (matchType.startsWith("W")) return age.agcWomenDescr || age.agcMenDescr || "";
  if (matchType.startsWith("D")) return age.agcMixtDescr || age.agcMenDescr || age.agcWomenDescr || "";
  return age.agcMenDescr || age.agcWomenDescr || "";
}

function rankingPart(event: RawEvent): string {
  const upper = cleanText(event.rankingTypeEvtIdUpperRanking?.RankingType?.rnkDescr ?? "");
  const lower = cleanText(event.rankingTypeEvtIdLowerRanking?.RankingType?.rnkDescr ?? "");
  if (upper && lower) return `${upper}/${lower}`;
  return upper || lower;
}

export function buildEventName(event: RawEvent): string {
  const matchType = cleanText(event.ioMatchType?.IoMatchType?.mtpName ?? "");
  const age = ageCategoryFor(matchType, event.ageCategoryEvtIdAgeCategory?.AgeCategory);
  const parts = [matchType, age, rankingPart(event)].filter((part) => part !== "");
  const name = parts.join(" ").trim();
  return name || cleanText(event.evtDescr ?? "") || `Event ${toNumber(event.eventId)}`;
}

export function mapTournamentMeta(payload: unknown): TournamentMeta {
  const tournament = (payload as { Iotto?: { IoTournament?: Record<string, unknown> } }).Iotto
    ?.IoTournament;
  if (!tournament) {
    throw new Error("Swisstennis-Turnierdaten sind unvollständig (kein IoTournament).");
  }
  const rawEvents = asArray<RawEvent>(
    (tournament.ioEventSet as { IoEvent?: RawEvent | RawEvent[] } | undefined)?.IoEvent,
  );

  const events: TournamentEventMeta[] = rawEvents
    .map((event, index) => {
      const eventName = buildEventName(event);
      return {
        eventId: toNumber(event.eventId),
        eventName,
        discipline: disciplineOf(eventName),
        mode: cleanText(event.ioEventMode?.IoEventMode?.evmName ?? ""),
        matchTypeId: toNumber(event.ioMatchType?.IoMatchType?.matchTypeId),
        sortOrder: index,
      };
    })
    .filter((event) => event.eventId > 0);

  return {
    tournamentName: cleanText((tournament as { trnName?: string }).trnName ?? "") || "Turnier",
    events,
  };
}
