/**
 * Empfang der Waidcup-Adminseite: führt das (turnierweite) Bezahlt-Tracking und
 * den (tagesbezogenen) Check-In zu einer Personenliste zusammen, damit sich beides
 * an einem Tisch in einer Zeile erledigen lässt. Keine eigene Auswertungslogik –
 * reine Zusammenführung von getWaidcupPayments (Kosten/Status/Totals) und der
 * heutigen Check-In-Liste (Anwesenheit + heutige Startzeit). Personen sind über
 * denselben waidcupPersonKey verknüpft; wer heute spielt, steht wegen der
 * Match-Ableitung stets auch im Bezahlt-Tracking.
 */
import type { WaidcupDeskPerson, WaidcupDeskResponse } from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";
import { getWaidcupCheckin } from "./waidcup-checkin-service.js";
import { getWaidcupPayments } from "./waidcup-payments-service.js";

export function getWaidcupDesk(
  database: TcwDatabase,
  tournamentId: number,
  day: string,
): WaidcupDeskResponse {
  const payments = getWaidcupPayments(database, tournamentId);
  const checkin = getWaidcupCheckin(database, tournamentId, day);
  const todayByKey = new Map(checkin.persons.map((person) => [person.personKey, person]));

  const persons: WaidcupDeskPerson[] = payments.persons.map((person) => {
    const today = todayByKey.get(person.personKey);
    return {
      personKey: person.personKey,
      name: person.name,
      disciplines: person.disciplines,
      cost: person.cost,
      status: person.status,
      firstMatchDate: person.firstMatchDate,
      firstMatchTime: person.firstMatchTime,
      playsToday: today !== undefined,
      todayMatchTime: today?.matchTime ?? "",
      todayMatchCourt: today?.matchCourt ?? "",
      present: today?.present ?? false,
    };
  });

  return {
    day,
    persons,
    totalOpen: payments.totalOpen,
    totalPaid: payments.totalPaid,
    totalCancelled: payments.totalCancelled,
  };
}
