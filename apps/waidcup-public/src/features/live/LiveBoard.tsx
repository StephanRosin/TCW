/**
 * Gemeinsame Zeilenliste des Live-Boards („Jetzt auf dem Platz" und
 * „Als Nächstes"): identische Spalten Platz – Uhrzeit – Matchup – Kategorie.
 * Wird von der Live-Seite und vom Kiosk (grossformatig) verwendet.
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

export function LiveMatchRows({ matches }: { matches: WaidcupLiveMatch[] }): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="live-board">
      <ul className="live-board__list">
        {matches.map((match, index) => {
          const when = isTodayLocal(match.scheduledDate)
            ? match.scheduledTime
            : `${shortDate(match.scheduledDate)} ${match.scheduledTime}`;
          const isDouble = match.side1Names.length > 1 || match.side2Names.length > 1;
          return (
            <li className="live-board__row" key={`${match.court}-${match.scheduledTime}-${index}`}>
              <span className="live-board__court">{match.court || t("live.noCourt")}</span>
              <span className="live-board__when">{when}</span>
              {isDouble ? (
                <span className="live-board__players live-board__players--stacked">
                  <span className="live-board__side">{match.side1Names.join(" / ")}</span>
                  <span className="live-board__side">
                    <span className="live-board__vs">vs</span> {match.side2Names.join(" / ")}
                  </span>
                </span>
              ) : (
                <span className="live-board__players">
                  <span className="live-board__side">{match.side1Names.join(" / ")}</span>
                  <span className="live-board__vs">vs</span>
                  <span className="live-board__side">{match.side2Names.join(" / ")}</span>
                </span>
              )}
              <span className="live-board__event">{match.eventName}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
