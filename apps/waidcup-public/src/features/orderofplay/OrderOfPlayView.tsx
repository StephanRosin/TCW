/**
 * Order of Play: Tagesspielplan als Zeit-Band + Platz-Zeilen.
 *
 * Auf der Seite wird die Tabelle theme-angepasst dargestellt. Für den
 * E-Mail-Export liegt zusätzlich eine unsichtbare Tabelle mit exakt den
 * fixen Inline-Farben im DOM – „Für E-Mail kopieren" selektiert genau diese
 * und legt sie als Rich-HTML in die Zwischenablage (funktioniert auch über
 * http im LAN via execCommand).
 */
import { useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import type { WaidcupLiveMatch } from "@tcw/shared";
import { DataView, useI18n, useResource } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";

interface Grid {
  times: string[];
  courts: number[];
  byKey: Map<string, WaidcupLiveMatch>;
}

/** „Weiss Xenia (R5)" → { label: "Weiss Xenia", ranking: "R5" }. */
function splitRanking(name: string): { label: string; ranking: string } {
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(name.trim());
  return m ? { label: m[1]!.trim(), ranking: m[2]!.trim() } : { label: name.trim(), ranking: "" };
}

/** Eine Seite als „(R5) Weiss Xenia" bzw. Doppel „(R5/R4) A / B". */
function formatSide(names: string[]): string {
  const parts = names.map(splitRanking);
  const rankings = parts.map((p) => p.ranking).filter((r) => r !== "");
  const labels = parts.map((p) => p.label).join(" / ");
  return (rankings.length > 0 ? `(${rankings.join("/")}) ` : "") + labels;
}

function matchText(match: WaidcupLiveMatch): string {
  return `${formatSide(match.side1Names)} vs. ${formatSide(match.side2Names)}`;
}

function courtNumber(court: string): number {
  return Number(court.match(/\d+/)?.[0] ?? 0);
}

function buildGrid(matches: WaidcupLiveMatch[]): Grid {
  const times = [...new Set(matches.map((m) => m.scheduledTime))].sort();
  const maxCourt = Math.max(6, ...matches.map((m) => courtNumber(m.court)));
  const courts = Array.from({ length: maxCourt }, (_, i) => i + 1);
  const byKey = new Map<string, WaidcupLiveMatch>();
  for (const m of matches) {
    const key = `${courtNumber(m.court)}|${m.scheduledTime}`;
    if (!byKey.has(key)) byKey.set(key, m);
  }
  return { times, courts, byKey };
}

/* --- Feste E-Mail-Farben (dürfen sich NICHT ans Theme anpassen) --- */
const EMAIL: Record<string, CSSProperties> = {
  table: {
    borderCollapse: "collapse",
    fontFamily: "Calibri, Arial, sans-serif",
    border: "1px solid #1a8f4a",
  },
  court: {
    width: 100,
    backgroundColor: "#1a8f4a",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: "10.5pt",
    textAlign: "center",
    padding: "8px 4px",
    border: "1px solid #14713a",
  },
  band: {
    backgroundColor: "#39b54a",
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: "10.5pt",
    textAlign: "center",
    padding: "6px 4px",
    border: "1px solid #14713a",
  },
  cell: {
    backgroundColor: "#ffffff",
    fontSize: "9pt",
    textAlign: "center",
    verticalAlign: "middle",
    padding: "8px 6px",
    border: "1px solid #cdeed4",
    color: "#1f4a2b",
    lineHeight: 1.35,
  },
  empty: {
    backgroundColor: "#ffffff",
    fontSize: "9pt",
    textAlign: "center",
    verticalAlign: "middle",
    padding: "8px 6px",
    border: "1px solid #cdeed4",
    color: "#b3b3b3",
    fontStyle: "italic",
  },
};

/** Eine Tabelle rendern – entweder theme-angepasst (CSS-Klassen) oder mit den
 *  festen E-Mail-Inline-Styles. Struktur ist identisch. */
function ScheduleTable({ grid, email }: { grid: Grid; email: boolean }): JSX.Element {
  const { times, courts, byKey } = grid;
  const cls = (name: string): string | undefined => (email ? undefined : name);
  const st = (name: keyof typeof EMAIL): CSSProperties | undefined =>
    email ? { ...EMAIL[name], ...(name === "table" ? { width: courts.length * 100 } : {}) } : undefined;

  return (
    <table className={cls("oopt")} style={st("table")} cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          {courts.map((c) => (
            <td key={c} className={cls("oopt__court")} style={st("court")}>
              Court {c}
            </td>
          ))}
        </tr>
        {times.map((time) => (
          <ScheduleTimeBlock key={time} time={time} courts={courts} byKey={byKey} email={email} cls={cls} st={st} />
        ))}
      </tbody>
    </table>
  );
}

function ScheduleTimeBlock({
  time,
  courts,
  byKey,
  email,
  cls,
  st,
}: {
  time: string;
  courts: number[];
  byKey: Map<string, WaidcupLiveMatch>;
  email: boolean;
  cls: (name: string) => string | undefined;
  st: (name: keyof typeof EMAIL) => CSSProperties | undefined;
}): JSX.Element {
  return (
    <>
      <tr>
        <td className={cls("oopt__band")} style={st("band")} colSpan={courts.length}>
          {time} Uhr
        </td>
      </tr>
      <tr>
        {courts.map((c) => {
          const match = byKey.get(`${c}|${time}`);
          if (!match) {
            return (
              <td key={c} className={cls("oopt__cell oopt__cell--empty")} style={st("empty")}>
                –
              </td>
            );
          }
          return (
            <td key={c} className={cls("oopt__cell")} style={st("cell")}>
              {matchText(match)}
            </td>
          );
        })}
      </tr>
    </>
  );
}

function OrderOfPlayTable({ matches }: { matches: WaidcupLiveMatch[] }): JSX.Element {
  const { t, language } = useI18n();
  const emailRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const grid = useMemo(() => buildGrid(matches), [matches]);
  const dateLabel = useMemo(() => {
    const iso = matches[0]?.scheduledDate ?? "";
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return p
      ? new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3])).toLocaleDateString(language, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";
  }, [matches, language]);

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
    const html = table.outerHTML;
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
      {/* Doppelklick auf das Datum kopiert die E-Mail-Tabelle (verstecktes
          Admin-Feature; kein sichtbarer Button). */}
      <div className="oop__bar">
        <span className="oop__date" onDoubleClick={() => void copyForEmail()} title="">
          {dateLabel}
        </span>
        {copied ? <span className="oop__copied">✓ {t("orderOfPlay.copied")}</span> : null}
      </div>
      <div className="oop__scroll">
        <ScheduleTable grid={grid} email={false} />
      </div>
      {/* Unsichtbare, exakt eingefärbte Kopiervorlage für die E-Mail */}
      <div ref={emailRef} aria-hidden="true" className="oop__email">
        <ScheduleTable grid={grid} email />
      </div>
    </div>
  );
}

export function OrderOfPlayView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => waidcupApi.orderOfPlay(), []);
  return (
    <section>
      <DataView state={state} errorKey="live.loadError">
        {(data) =>
          data.matches.length === 0 ? (
            <div className="state">{t("orderOfPlay.empty")}</div>
          ) : (
            <OrderOfPlayTable matches={data.matches} />
          )
        }
      </DataView>
    </section>
  );
}
