/**
 * PublicDisplayEvent → Anmeldungen eines Events.
 */
import { asArray, cleanText } from "./normalize.js";

export interface RegistrationRecord {
  playerKey: string;
  playerName: string;
  playerName2: string | null;
  firstName: string;
  lastName: string;
  firstName2: string;
  lastName2: string;
  licenseNumber: string | null;
  licenseNumber2: string | null;
  confirmed: number;
  ranking: string | null;
  ranking2: string | null;
  registeredOn: string;
  registeredOnSort: string;
  note: string | null;
  sortOrder: number;
}

interface RawRegisteredOn {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
}

interface ParsedDate {
  display: string;
  sort: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Swisstennis-Datumsobjekt (month 0-basiert) → Anzeige/Sortierform. */
function parseRegisteredOn(value: RawRegisteredOn | string | undefined): ParsedDate {
  if (value && typeof value === "object" && value.year != null) {
    const month = (value.month ?? 0) + 1;
    const day = value.day ?? 1;
    const hour = value.hour ?? 0;
    const minute = value.minute ?? 0;
    const date = `${pad2(day)}.${pad2(month)}.${value.year}`;
    const time = hour + minute > 0 ? ` ${pad2(hour)}:${pad2(minute)}` : "";
    const sort = `${value.year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(value.second ?? 0)}`;
    return { display: `${date}${time}`, sort };
  }
  const raw = cleanText(value ?? "");
  return { display: raw, sort: raw };
}

interface RawPlayer {
  playerId?: number | string;
  plyFirstName?: string;
  plyName?: string;
  plyFirstName2?: string;
  plyName2?: string;
  plyLicenceNb?: string;
  plyLicenceNb2?: string;
  plyConfirmed?: number;
  plyRankingComment?: string;
  plyRankingComment2?: string;
  plyRegisteredOn?: RawRegisteredOn | string;
  plyComment?: string;
}

function fullName(first: string, last: string): string {
  return `${first} ${last}`.replace(/\s+/g, " ").trim();
}

function toRecord(player: RawPlayer, index: number): RegistrationRecord {
  const firstName = cleanText(player.plyFirstName ?? "");
  const lastName = cleanText(player.plyName ?? "");
  const firstName2 = cleanText(player.plyFirstName2 ?? "");
  const lastName2 = cleanText(player.plyName2 ?? "");
  const name2 = fullName(firstName2, lastName2);
  const registered = parseRegisteredOn(player.plyRegisteredOn);
  const playerId = cleanText(String(player.playerId ?? ""));

  return {
    playerKey: playerId || `${firstName}|${lastName}|${index}`,
    playerName: fullName(firstName, lastName),
    playerName2: name2 || null,
    firstName,
    lastName,
    firstName2,
    lastName2,
    licenseNumber: cleanText(player.plyLicenceNb ?? "") || null,
    licenseNumber2: cleanText(player.plyLicenceNb2 ?? "") || null,
    confirmed: player.plyConfirmed === 1 ? 1 : 0,
    ranking: cleanText(player.plyRankingComment ?? "") || null,
    ranking2: cleanText(player.plyRankingComment2 ?? "") || null,
    registeredOn: registered.display,
    registeredOnSort: registered.sort,
    note: cleanText(player.plyComment ?? "") || null,
    sortOrder: index,
  };
}

export function mapEventRegistrations(payload: unknown): RegistrationRecord[] {
  const event = (payload as { Iotto?: { IoEvent?: { ioPlayerSet?: { IoPlayer?: unknown } } } }).Iotto
    ?.IoEvent;
  if (!event) {
    return [];
  }
  const players = asArray<RawPlayer>(event.ioPlayerSet?.IoPlayer as RawPlayer | RawPlayer[] | undefined);
  return players.map((player, index) => toRecord(player, index));
}
