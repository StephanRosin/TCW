/**
 * Kiosk-Modus für den Grossbildschirm am Turnier: chromelos, dunkel/hell,
 * selbst-aktualisierend (nur lokale API, keine Swisstennis-Last). Zwei Ziele:
 * das Live-Board („Wer spielt gerade") oder ein Order-of-Play-Tag (Tagesraster
 * mit Ergebnissen und Tennisball an der laufenden Zeitzeile).
 */
import { useEffect, useLayoutEffect, useRef, useState, type JSX, type ReactNode } from "react";
import type { WaidcupLiveResponse } from "@tcw/shared";
import { useI18n } from "@tcw/tournament-ui";
import type { KioskTarget } from "../../app/navigation.js";
import { waidcupApi } from "../../api/client.js";
import { LiveMatchRows } from "./../live/LiveBoard.js";
import {
  ScheduleTable,
  buildGrid,
  currentBandTime,
  formatDate,
} from "../orderofplay/OrderOfPlaySchedule.js";
import { TournamentResults } from "../orderofplay/TournamentResults.js";

const REFRESH_MS = 30_000;
const MODE_KEY = "waidcup-kiosk-mode";
const ANIMATION_KEY = "waidcup-kiosk-animation";

type KioskMode = "light" | "dark";
type OrderOfPlayData = Awaited<ReturnType<typeof waidcupApi.orderOfPlay>>;

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

/** Gemeinsamer Rahmen (Kopf mit Marke, Titel, Umschaltern, Uhr) + Inhalt. */
function KioskShell({
  mode,
  animated,
  now,
  title,
  showAnimation,
  onToggleMode,
  onToggleAnimation,
  children,
}: Readonly<{
  mode: KioskMode;
  animated: boolean;
  now: Date;
  title: ReactNode;
  showAnimation: boolean;
  onToggleMode: () => void;
  onToggleAnimation: () => void;
  children: ReactNode;
}>): JSX.Element {
  const { t } = useI18n();
  return (
    <div className={`kiosk kiosk--${mode}${animated ? "" : " kiosk--no-anim"}`}>
      <header className="kiosk__head">
        <div className="kiosk__brand">
          <img src="/logo-tcw.png" alt="TC Waidberg" />
          <span>{t("app.title")}</span>
        </div>
        <div className="kiosk__title">{title}</div>
        <div className="kiosk__meta">
          {showAnimation ? (
            <button
              type="button"
              className="kiosk__mode"
              onClick={onToggleAnimation}
              title={animated ? t("kiosk.animationsOff") : t("kiosk.animationsOn")}
              aria-label={animated ? t("kiosk.animationsOff") : t("kiosk.animationsOn")}
            >
              {animated ? <PauseIcon /> : <PlayIcon />}
            </button>
          ) : null}
          <button
            type="button"
            className="kiosk__mode"
            onClick={onToggleMode}
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
      {children}
    </div>
  );
}

/** Inhalt für das Live-Board („Wer spielt gerade" + „Als Nächstes"). */
function LiveBody({ board }: Readonly<{ board: WaidcupLiveResponse | null }>): JSX.Element {
  const { t } = useI18n();
  if (board === null) return <div className="kiosk__empty">{t("common.loading")}</div>;
  // Läuft gerade: die aktuellen Partien – sonst der Hinweis „niemand spielt".
  // Die „Als Nächstes"-Leiste wird UNABHÄNGIG davon gezeigt (auch wenn gerade
  // niemand spielt, z. B. vor dem ersten Match), solange es kommende Partien gibt.
  return (
    <>
      {board.now.length > 0 ? (
        <LiveMatchRows matches={board.now} ballCourts header />
      ) : (
        <div className="kiosk__empty">{t("live.nobodyPlaying")}</div>
      )}
      {board.upcoming.length > 0 ? (
        <footer className="kiosk__upcoming">
          <div className="kiosk__upcoming-title">{t("live.upcomingTitle")}</div>
          <LiveMatchRows matches={board.upcoming.slice(0, 6)} ballCourts />
        </footer>
      ) : null}
    </>
  );
}

/**
 * Skaliert den Inhalt per `transform: scale` so, dass er den verfügbaren Platz
 * (Breite UND Höhe) ohne Scrollen füllt – auch vergrössernd auf grossen Screens.
 * `deps` erzwingt Neuberechnung bei Datenwechsel. (Analog zum Live-Kiosk, der
 * das rein per vw/vh-Schriften macht – bei der Tabelle ist Fit-to-Screen robuster.)
 */
function FitBox({ children, deps }: Readonly<{ children: ReactNode; deps: unknown }>): JSX.Element {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return undefined;
    const fit = (): void => {
      // scrollWidth/Height sind von transform unbeeinflusst (Layoutgrösse).
      const naturalWidth = inner.scrollWidth;
      const naturalHeight = inner.scrollHeight;
      if (naturalWidth === 0 || naturalHeight === 0) return;
      const next = Math.min(outer.clientWidth / naturalWidth, outer.clientHeight / naturalHeight, 3);
      setScale(next > 0 ? next : 1);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [deps]);

  return (
    <div ref={outerRef} className="kiosk__fit">
      <div ref={innerRef} className="kiosk__fit-inner" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** Inhalt für einen Order-of-Play-Tag (Tagesraster mit Ergebnissen + Ball). */
function OrderOfPlayBody({
  data,
  day,
  now,
}: Readonly<{ data: OrderOfPlayData | null; day: "today" | "tomorrow"; now: Date }>): JSX.Element {
  const { t } = useI18n();
  if (data === null) return <div className="kiosk__empty">{t("common.loading")}</div>;
  // Nach dem Turnier bliebe hier dauerhaft ein leeres Raster stehen – der
  // Grossbildschirm zeigt dann die Sieger.
  if (data.results.finished) {
    return (
      <FitBox deps={`results|${data.results.events.length}`}>
        <TournamentResults events={data.results.events} playerUrls={data.playerUrls} compact />
      </FitBox>
    );
  }
  const matches = day === "today" ? data.today : data.tomorrow;
  if (matches.length === 0) {
    return (
      <div className="kiosk__empty">
        {t(day === "today" ? "orderOfPlay.empty" : "orderOfPlay.emptyTomorrow")}
      </div>
    );
  }
  // Kiosk: leere Plätze ganz ausblenden, damit die belegten den Platz voll nutzen.
  const grid = buildGrid(matches, { occupiedOnly: true });
  return (
    <FitBox deps={`${day}|${matches.length}|${grid.times.length}`}>
      <div className="kiosk__oop">
        <ScheduleTable
          grid={grid}
          email={false}
          playerUrls={data.playerUrls}
          currentTime={currentBandTime(grid.times, matches[0]?.scheduledDate, now)}
        />
      </div>
    </FitBox>
  );
}

export function KioskView({ target }: Readonly<{ target: KioskTarget }>): JSX.Element {
  const { t, language } = useI18n();
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<KioskMode>(() => storedMode());
  const [animated, setAnimated] = useState<boolean>(() => storedAnimation());
  const [board, setBoard] = useState<WaidcupLiveResponse | null>(null);
  const [orderOfPlay, setOrderOfPlay] = useState<OrderOfPlayData | null>(null);
  const isLive = target.kind === "live";

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
      if (isLive) {
        waidcupApi
          .live()
          .then((data) => {
            if (active) setBoard(data);
          })
          .catch(() => {
            /* letzter Stand bleibt; nächster Versuch in 60 s. */
          });
      } else {
        waidcupApi
          .orderOfPlay()
          .then((data) => {
            if (active) setOrderOfPlay(data);
          })
          .catch(() => {
            /* letzter Stand bleibt; nächster Versuch in 60 s. */
          });
      }
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isLive]);

  const day = target.kind === "orderofplay" ? target.day : "today";
  const dayMatches = day === "today" ? orderOfPlay?.today : orderOfPlay?.tomorrow;
  const dayIso = dayMatches?.[0]?.scheduledDate;
  const oopTitle =
    formatDate(dayIso, language) || t(day === "today" ? "orderOfPlay.today" : "orderOfPlay.tomorrow");

  return (
    <KioskShell
      mode={mode}
      animated={animated}
      now={now}
      showAnimation={isLive}
      onToggleMode={toggleMode}
      onToggleAnimation={toggleAnimation}
      title={isLive ? <>🎾 {t("live.nowTitle")}</> : <>🎾 {oopTitle}</>}
    >
      {isLive ? (
        <LiveBody board={board} />
      ) : (
        <OrderOfPlayBody data={orderOfPlay} day={day} now={now} />
      )}
    </KioskShell>
  );
}
