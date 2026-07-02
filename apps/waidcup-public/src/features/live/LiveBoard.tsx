/**
 * Gemeinsame Bausteine des Live-Boards („Wer spielt gerade"): Kacheln der
 * laufenden Partien und Liste der nächsten Partien. Wird von der Live-Seite
 * und vom Kiosk (grossformatig) verwendet.
 */
import type { JSX } from "react";
import type { WaidcupLiveMatch } from "@tcw/shared";
import { useI18n } from "@tcw/tournament-ui";

function names(match: WaidcupLiveMatch): { side1: string; side2: string } {
  return { side1: match.side1Names.join(" / "), side2: match.side2Names.join(" / ") };
}

/** "2026-07-04" → "4.7." (kompakt, fürs Board). */
function shortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${Number(match[3])}.${Number(match[2])}.` : iso;
}

/** Laufende Partien als Zeilen (eine pro Platz) – 6 Plätze passen so immer. */
export function LiveCourtRows({ matches }: { matches: WaidcupLiveMatch[] }): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="live-now-wrap">
      <ul className="live-now">
        {matches.map((match, index) => {
          const { side1, side2 } = names(match);
          return (
            <li className="live-now__row" key={`${match.court}-${index}`}>
              <span className="live-now__court">{match.court || t("live.noCourt")}</span>
              <span className="live-now__players">
                <span className="live-now__side">{side1}</span>
                <span className="live-tile__vs">vs</span>
                <span className="live-now__side">{side2}</span>
              </span>
              <span className="live-now__meta">
                {match.eventName} · {t("live.since", { value: match.scheduledTime })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function UpcomingList({ matches, isToday }: { matches: WaidcupLiveMatch[]; isToday: (iso: string) => boolean }): JSX.Element {
  const { t } = useI18n();
  return (
    <ul className="live-upcoming">
      {matches.map((match, index) => {
        const { side1, side2 } = names(match);
        const when = isToday(match.scheduledDate)
          ? match.scheduledTime
          : `${shortDate(match.scheduledDate)} ${match.scheduledTime}`;
        return (
          <li className="live-upcoming__row" key={`${match.scheduledDate}-${match.scheduledTime}-${index}`}>
            <span className="live-upcoming__when">{when}</span>
            <span className="live-upcoming__court">{match.court || t("live.noCourt")}</span>
            <span className="live-upcoming__players">
              {side1} <span className="live-tile__vs">vs</span> {side2}
            </span>
            <span className="live-upcoming__event">{match.eventName}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Heute im lokalen Kalender? (Board-Anzeigen kürzen heutige Termine auf die Uhrzeit.) */
export function isTodayLocal(iso: string): boolean {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return iso === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
