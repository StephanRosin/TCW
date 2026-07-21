/**
 * Order of Play: Tagesspielplan als Zeit-Band + Platz-Zeilen (heute/morgen).
 *
 * Das eigentliche Rendering (inkl. Ergebniszeile, fettem Gewinner und Tennisball
 * an der laufenden Zeitzeile) liegt geteilt in OrderOfPlaySchedule.tsx – dieselbe
 * Tabelle nutzt der Kiosk-Modus. Für den E-Mail-Export liegt zusätzlich eine
 * unsichtbare Tabelle mit fixen Inline-Farben im DOM; „Für E-Mail kopieren"
 * (Doppelklick aufs Datum) selektiert genau diese.
 */
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { WaidcupLiveMatch } from "@tcw/shared";
import { ResourceView, useI18n, useResource } from "@tcw/tournament-ui";
import { orderOfPlayKioskHash } from "../../app/navigation.js";
import { waidcupApi } from "../../api/client.js";
import { ScheduleTable, buildGrid, currentBandTime, formatDate } from "./OrderOfPlaySchedule.js";

const NOW_TICK_MS = 30_000;

function OrderOfPlayBoard({
  today,
  tomorrow,
  playerUrls,
}: Readonly<{
  today: WaidcupLiveMatch[];
  tomorrow: WaidcupLiveMatch[];
  playerUrls: Record<string, string>;
}>): JSX.Element {
  const { t, language } = useI18n();
  const emailRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Standard-Tab: heute – ausser heute ist leer und morgen hat Partien.
  const [day, setDay] = useState<"today" | "tomorrow">(today.length > 0 || tomorrow.length === 0 ? "today" : "tomorrow");

  // Uhrzeit für den Tennisball an der aktuell laufenden Zeitzeile aktuell halten.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Nur belegte Plätze als Spalten (wie im Kiosk) – gilt für die sichtbare
  // Ansicht UND die E-Mail-Kopiervorlage (morgen). Leere Plätze fallen weg.
  const gridToday = useMemo(() => buildGrid(today, { occupiedOnly: true }), [today]);
  const gridTomorrow = useMemo(() => buildGrid(tomorrow, { occupiedOnly: true }), [tomorrow]);
  const activeMatches = day === "today" ? today : tomorrow;
  const activeGrid = day === "today" ? gridToday : gridTomorrow;
  const dateLabel = useMemo(() => formatDate(activeMatches[0]?.scheduledDate, language), [activeMatches, language]);
  const currentTime = currentBandTime(activeGrid.times, activeMatches[0]?.scheduledDate, now);

  const flagCopied = (): void => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  /**
   * Legt die E-Mail-Tabelle als Rich-HTML in die Zwischenablage. Wichtig:
   * text/html EXPLIZIT setzen, sonst kopieren manche Browser/Mail-Clients nur
   * Text. Moderne Clipboard-API (nur secure context) zuerst, sonst der
   * copy-Event-Weg (funktioniert auch über http im LAN).
   */
  const copyForEmail = async (): Promise<void> => {
    const table = emailRef.current?.querySelector("table");
    if (!table) return;
    // charset-Wrapper: hilft Mail-Clients, den Inhalt als HTML (UTF-8) zu erkennen.
    const html = `<meta charset="utf-8">${table.outerHTML}`;
    const text = table.innerText;

    if (window.isSecureContext && navigator.clipboard && typeof window.ClipboardItem === "function") {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
        flagCopied();
        return;
      } catch {
        /* Fallback unten */
      }
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(table);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const onCopy = (event: ClipboardEvent): void => {
      event.preventDefault();
      event.clipboardData?.setData("text/html", html);
      event.clipboardData?.setData("text/plain", text);
    };
    document.addEventListener("copy", onCopy);
    try {
      if (document.execCommand("copy")) flagCopied();
    } finally {
      document.removeEventListener("copy", onCopy);
      selection?.removeAllRanges();
    }
  };

  return (
    <div className="oop">
      <div className="subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="chip"
          aria-selected={day === "today"}
          onClick={() => setDay("today")}
        >
          {t("orderOfPlay.today")}
        </button>
        <button
          type="button"
          role="tab"
          className="chip"
          aria-selected={day === "tomorrow"}
          onClick={() => setDay("tomorrow")}
        >
          {t("orderOfPlay.tomorrow")}
        </button>
      </div>
      {/* Doppelklick auf das Datum kopiert die E-Mail-Tabelle für MORGEN
          (verstecktes Admin-Feature; kein sichtbarer Button). */}
      <div className="oop__bar">
        <span
          className="oop__date"
          onDoubleClick={() => void copyForEmail()}
          title={t("orderOfPlay.copyHint")}
        >
          {dateLabel}
        </span>
        {copied ? <span className="oop__copied">✓ {t("orderOfPlay.copied")}</span> : null}
        <a
          className="link-btn oop__kiosk"
          href={orderOfPlayKioskHash(day)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("orderOfPlay.openKiosk")} ↗
        </a>
      </div>
      {activeGrid.times.length > 0 ? (
        <div className="oop__scroll">
          <ScheduleTable grid={activeGrid} email={false} playerUrls={playerUrls} currentTime={currentTime} />
        </div>
      ) : (
        <div className="state">{day === "today" ? t("orderOfPlay.empty") : t("orderOfPlay.emptyTomorrow")}</div>
      )}
      {/* Unsichtbare, exakt eingefärbte Kopiervorlage für die E-Mail (morgen) */}
      <div ref={emailRef} aria-hidden="true" className="oop__email">
        <ScheduleTable grid={gridTomorrow} email />
      </div>
    </div>
  );
}

export function OrderOfPlayView(): JSX.Element {
  const state = useResource(() => waidcupApi.orderOfPlay(), []);
  return (
    <section>
      <ResourceView state={state} errorKey="live.loadError">
        {(data) => (
          <OrderOfPlayBoard today={data.today} tomorrow={data.tomorrow} playerUrls={data.playerUrls} />
        )}
      </ResourceView>
    </section>
  );
}
