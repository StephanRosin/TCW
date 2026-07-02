/**
 * Kiosk-Modus für den Grossbildschirm am Turnier: chromelos, dunkel,
 * grossformatige Kacheln der laufenden Partien plus „Als Nächstes"-Leiste.
 * Aktualisiert sich selbst (nur lokale API, keine Swisstennis-Last).
 */
import { useEffect, useState, type JSX } from "react";
import type { WaidcupLiveResponse } from "@tcw/shared";
import { useI18n } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";
import { isTodayLocal, LiveCourtTiles, UpcomingList } from "./../live/LiveBoard.js";

const REFRESH_MS = 60_000;

function clockLabel(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateLabel(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

export function KioskView(): JSX.Element {
  const { t } = useI18n();
  const [board, setBoard] = useState<WaidcupLiveResponse | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      setNow(new Date());
      waidcupApi
        .live()
        .then((data) => {
          if (active) setBoard(data);
        })
        .catch(() => {
          /* Board behält den letzten Stand; nächster Versuch in 60 s. */
        });
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="kiosk">
      <header className="kiosk__head">
        <div className="kiosk__brand">
          <img src="/logo-tcw.png" alt="TC Waidberg" />
          <span>{t("app.title")}</span>
        </div>
        <div className="kiosk__title">🎾 {t("live.nowTitle")}</div>
        <div className="kiosk__clock">
          <span className="kiosk__time">{clockLabel(now)}</span>
          <span className="kiosk__date">{dateLabel(now)}</span>
        </div>
      </header>

      {board === null ? (
        <div className="kiosk__empty">{t("common.loading")}</div>
      ) : board.now.length === 0 ? (
        <div className="kiosk__empty">{t("live.nobodyPlaying")}</div>
      ) : (
        <LiveCourtTiles matches={board.now} />
      )}

      {board !== null && board.upcoming.length > 0 ? (
        <footer className="kiosk__upcoming">
          <div className="kiosk__upcoming-title">{t("live.upcomingTitle")}</div>
          <UpcomingList matches={board.upcoming.slice(0, 6)} isToday={isTodayLocal} />
        </footer>
      ) : null}
    </div>
  );
}
