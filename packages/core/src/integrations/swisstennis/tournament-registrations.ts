/**
 * `/tournaments/category-info` → Anmeldungen einer Kategorie.
 *
 * Anmeldedatum, E-Mail und Mobilnummer gibt Swisstennis seit dem 19.08.2026
 * nicht mehr heraus – das sind Personendaten, die vorher ohne Anmeldung offen
 * lagen. Sie kommen hier leer zurück; der Import übernimmt vorhandene Werte
 * aus der Datenbank, statt sie zu überschreiben.
 *
 * Der Schlüssel ist die Lizenznummer (im Doppel beide), weil die neue
 * Schnittstelle keine Spieler-ID mehr liefert.
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

interface RawPlayer {
  name?: string;
  licenceNb?: string;
  rank?: string;
  confirmed?: number | boolean;
}

/** Die API schreibt Nachname zuerst: "Rosin Stephan". */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = cleanText(fullName).split(" ").filter((part) => part !== "");
  if (parts.length < 2) {
    return { firstName: "", lastName: parts[0] ?? "" };
  }
  return { firstName: parts.at(-1) ?? "", lastName: parts.slice(0, -1).join(" ") };
}

export function mapEventRegistrations(payload: unknown): RegistrationRecord[] {
  const players = asArray<RawPlayer[] | RawPlayer>((payload as { players?: unknown } | null)?.players as never);
  return players
    .map((entry, index): RegistrationRecord | null => {
      const team = asArray<RawPlayer>(entry as never);
      const first = team[0];
      const second = team[1];
      if (!first) return null;
      const name = cleanText(first.name ?? "");
      if (name === "") return null;
      const name2 = second ? cleanText(second.name ?? "") : "";
      const license = cleanText(first.licenceNb ?? "") || null;
      const license2 = second ? cleanText(second.licenceNb ?? "") || null : null;
      const split = splitName(name);
      const split2 = splitName(name2);
      return {
        playerKey: [license, license2].filter((value) => value !== null).join("|") || `${name}|${index}`,
        playerName: name,
        playerName2: name2 || null,
        firstName: split.firstName,
        lastName: split.lastName,
        firstName2: split2.firstName,
        lastName2: split2.lastName,
        licenseNumber: license,
        licenseNumber2: license2,
        confirmed: Number(first.confirmed) === 1 ? 1 : 0,
        ranking: cleanText(first.rank ?? "") || null,
        ranking2: second ? cleanText(second.rank ?? "") || null : null,
        registeredOn: "",
        registeredOnSort: "",
        note: null,
        sortOrder: index,
      };
    })
    .filter((record): record is RegistrationRecord => record !== null);
}
