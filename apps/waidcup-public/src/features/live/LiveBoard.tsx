/**
 * Gemeinsame Zeilenliste des Live-Boards („Jetzt auf dem Platz" und
 * „Als Nächstes"): identische Spalten Platz – Uhrzeit – Matchup – Kategorie.
 * Wird von der Live-Seite und vom Kiosk (grossformatig, mit Spaltenköpfen
 * und Tennisball-Badges statt "Platz N") verwendet.
 */
import type { JSX } from "react";
import type { WaidcupLiveMatch } from "@tcw/shared";
import { useI18n } from "@tcw/tournament-ui";

/** "2026-07-04" → "4.7." (kompakt, fürs Board). */
function shortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${Number(match[3])}.${Number(match[2])}.` : iso;
}

/** Heute im lokalen Kalender? (heutige Termine zeigen nur die Uhrzeit). */
function isTodayLocal(iso: string): boolean {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return iso === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function CourtLabel({ court, asBall }: { court: string; asBall: boolean }): JSX.Element {
  const { t } = useI18n();
  const number = court.match(/\d+/)?.[0];
  if (asBall && number !== undefined) {
    return (
      <span className="court-ball" title={court}>
        <span className="court-ball__seams" aria-hidden="true" />
        <span className="court-ball__num">{number}</span>
      </span>
    );
  }
  if (court === "") {
    return <>{t("live.noCourt")}</>;
  }
  // „Platz 1" → uebersetztes Label mit Nummer; ohne Nummer den Rohwert zeigen.
  return <>{number !== undefined ? t("live.court", { number }) : court}</>;
}

export function LiveMatchRows({
  matches,
  ballCourts = false,
  header = false,
}: {
  matches: WaidcupLiveMatch[];
  ballCourts?: boolean;
  header?: boolean;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="live-board">
      {header ? (
        <div className="live-board__row live-board__row--head">
          <span>{t("kiosk.colCourt")}</span>
          <span>{t("kiosk.colTime")}</span>
          <span>{t("kiosk.colMatch")}</span>
          <span>{t("kiosk.colEvent")}</span>
        </div>
      ) : null}
      <ul className="live-board__list">
        {matches.map((match, index) => {
          const when = isTodayLocal(match.scheduledDate)
            ? match.scheduledTime
            : `${shortDate(match.scheduledDate)} ${match.scheduledTime}`;
          return (
            <li className="live-board__row" key={`${match.court}-${match.scheduledTime}-${index}`}>
              <span className="live-board__court">
                <CourtLabel court={match.court} asBall={ballCourts} />
              </span>
              <span className="live-board__when">{when}</span>
              <span className="live-board__players">
                <span className="live-board__side">{match.side1Names.join(" / ")}</span>
                <span className="live-board__vs">vs</span>
                <span className="live-board__side">{match.side2Names.join(" / ")}</span>
              </span>
              <span className="live-board__event">{match.eventName}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
