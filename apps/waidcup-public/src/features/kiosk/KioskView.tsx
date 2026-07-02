/**
 * Kiosk-Modus für den Grossbildschirm am Turnier: chromelos, dunkel,
 * grossformatige Kacheln der laufenden Partien plus „Als Nächstes"-Leiste.
 * Aktualisiert sich selbst (nur lokale API, keine Swisstennis-Last).
 */
import { useEffect, useState, type JSX } from "react";
import type { WaidcupLiveResponse } from "@tcw/shared";
import { useI18n } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";
import { LiveMatchRows } from "./../live/LiveBoard.js";

const REFRESH_MS = 60_000;
const MODE_KEY = "waidcup-kiosk-mode";
const ANIMATION_KEY = "waidcup-kiosk-animation";

type KioskMode = "light" | "dark";

function storedMode(): KioskMode {
  try {
    return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function storedAnimation(): boolean {
  try {
    return localStorage.getItem(ANIMATION_KEY) !== "off";
  } catch {
    return true;
  }
}

function PauseIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" className="kiosk__mode-icon" aria-hidden="true">
      <rect x="3" y="2.5" width="3.6" height="11" rx="1" />
      <rect x="9.4" y="2.5" width="3.6" height="11" rx="1" />
    </svg>
  );
}

function PlayIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" className="kiosk__mode-icon" aria-hidden="true">
      <path d="M4.5 2.5 13 8l-8.5 5.5z" />
    </svg>
  );
}

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
  const [mode, setMode] = useState<KioskMode>(() => storedMode());
  const [animated, setAnimated] = useState<boolean>(() => storedAnimation());

  const toggleMode = (): void => {
    const next: KioskMode = mode === "light" ? "dark" : "light";
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* localStorage nicht verfügbar */
    }
    setMode(next);
  };

  const toggleAnimation = (): void => {
    const next = !animated;
    try {
      localStorage.setItem(ANIMATION_KEY, next ? "on" : "off");
    } catch {
      /* localStorage nicht verfügbar */
    }
    setAnimated(next);
  };

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
    <div className={`kiosk kiosk--${mode}${animated ? "" : " kiosk--no-anim"}`}>
      <header className="kiosk__head">
        <div className="kiosk__brand">
          <img src="/logo-tcw.png" alt="TC Waidberg" />
          <span>{t("app.title")}</span>
        </div>
        <div className="kiosk__title">🎾 {t("live.nowTitle")}</div>
        <div className="kiosk__meta">
          <button
            type="button"
            className="kiosk__mode"
            onClick={toggleAnimation}
            title={animated ? t("kiosk.animationsOff") : t("kiosk.animationsOn")}
            aria-label={animated ? t("kiosk.animationsOff") : t("kiosk.animationsOn")}
          >
            {animated ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="kiosk__mode"
            onClick={toggleMode}
            title={mode === "light" ? t("kiosk.toDark") : t("kiosk.toLight")}
            aria-label={mode === "light" ? t("kiosk.toDark") : t("kiosk.toLight")}
          >
            {mode === "light" ? "🌙" : "☀️"}
          </button>
          <div className="kiosk__clock">
            <span className="kiosk__time">{clockLabel(now)}</span>
            <span className="kiosk__date">{dateLabel(now)}</span>
          </div>
        </div>
      </header>

      {board === null ? (
        <div className="kiosk__empty">{t("common.loading")}</div>
      ) : board.now.length === 0 ? (
        <div className="kiosk__empty">{t("live.nobodyPlaying")}</div>
      ) : (
        <LiveMatchRows matches={board.now} ballCourts header />
      )}

      {board !== null && board.upcoming.length > 0 ? (
        <footer className="kiosk__upcoming">
          <div className="kiosk__upcoming-title">{t("live.upcomingTitle")}</div>
          <LiveMatchRows matches={board.upcoming.slice(0, 6)} ballCourts />
        </footer>
      ) : null}
    </div>
  );
}
