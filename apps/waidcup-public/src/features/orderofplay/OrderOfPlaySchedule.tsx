/**
 * Geteiltes Rendering des Order-of-Play-Rasters (Zeit-Bänder × Plätze) für die
 * normale Ansicht und den Kiosk-Modus.
 *
 * - `email=false`: theme-angepasste CSS-Klassen, Namen als Links, gespielte
 *   Partien mit Ergebniszeile (Gewinnerseite fett), Tennisball an der aktuell
 *   laufenden Zeitzeile.
 * - `email=true`: feste Inline-Farben für die „Für E-Mail kopieren"-Vorlage –
 *   bewusst OHNE Ergebnis/Ball/Links, damit sich der Kopier-Export nicht ändert.
 */
import type { CSSProperties, JSX } from "react";
import type { WaidcupLiveMatch } from "@tcw/shared";
import { PlayerLink, translateRound, useI18n } from "@tcw/tournament-ui";

export interface Grid {
  times: string[];
  courts: number[];
  byKey: Map<string, WaidcupLiveMatch>;
}

/** „Weiss Xenia (R5)" → { label: "Weiss Xenia", ranking: "R5" }. */
function splitRanking(name: string): { label: string; ranking: string } {
  const m = /^(.*?)\(([^()]*)\)$/.exec(name.trim());
  return m ? { label: m[1]!.trim(), ranking: m[2]!.trim() } : { label: name.trim(), ranking: "" };
}

/** Eine Seite als „(R5) Weiss Xenia" bzw. Doppel „(R5/R4) A / B". */
function formatSide(names: string[]): string {
  const parts = names.map(splitRanking);
  const rankings = parts.map((p) => p.ranking).filter((r) => r !== "");
  const labels = parts.map((p) => p.label).join(" / ");
  return (rankings.length > 0 ? `(${rankings.join("/")}) ` : "") + labels;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Zeit-Band-Beschriftung in der jeweils gängigen Schreibweise der UI-Sprache:
 *  de „18:00 Uhr", en „6:00 PM" (12-Stunden), fr „18h00", it „ore 18:00". */
export function formatTimeBand(time: string, language: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const hour = Number(m[1]);
  const minute = m[2]!;
  switch (language) {
    case "en": {
      const hour12 = ((hour + 11) % 12) + 1;
      return `${hour12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
    }
    case "fr":
      return `${String(hour).padStart(2, "0")}h${minute}`;
    case "it":
      return `ore ${time}`;
    default: // de (Basissprache)
      return `${time} Uhr`;
  }
}

/** Label für Partien mit noch offenen Spielern: „Event · Runde". */
function tbdLabel(match: WaidcupLiveMatch, t: Translate): string {
  return [match.eventName, translateRound(match.roundName, t)].filter((part) => part !== "").join(" · ");
}

/** Untertitel unter der Begegnung, solange kein Ergebnis vorliegt: „Event Runde"
 *  (z. B. „MS R1/R5 Viertelfinal"). */
function roundLine(match: WaidcupLiveMatch, t: Translate): string {
  return [match.eventName, translateRound(match.roundName, t)].filter((part) => part !== "").join(" ");
}

/** Nur für die E-Mail-Vorlage: reine Textzeile ohne Ergebnis. */
function matchText(match: WaidcupLiveMatch, t: Translate): string {
  const has1 = match.side1Names.length > 0;
  const has2 = match.side2Names.length > 0;
  if (!has1 && !has2) return tbdLabel(match, t);
  return `${has1 ? formatSide(match.side1Names) : "tbd"} vs. ${has2 ? formatSide(match.side2Names) : "tbd"}`;
}

/** Ein Spieler als „(R5) Nachname Vorname" (fürs mehrzeilige Anzeige-Layout). */
function playerLine(name: string): string {
  const { label, ranking } = splitRanking(name);
  return ranking !== "" ? `(${ranking}) ${label}` : label;
}

/** Eine Spielerseite (ein/zwei Namen), bei Sieg fett hervorgehoben. */
function MatchSide({
  names,
  side,
  winner,
  playerUrls,
}: Readonly<{
  names: string[];
  side: "a" | "b";
  winner: boolean;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  return (
    <>
      {names.map((n) => (
        <span
          key={`${side}-${n}`}
          className={winner ? "oopt__player oopt__player--winner" : "oopt__player"}
        >
          <PlayerLink name={n} label={playerLine(n)} playerUrls={playerUrls} />
        </span>
      ))}
    </>
  );
}

/** Anzeige-Zelle: beide Seiten, „vs" dazwischen, darunter ggf. das Ergebnis.
 *  Noch offene Spieler werden als „tbd" gezeigt; stehen beide noch nicht fest,
 *  erscheint stattdessen „Event · Runde". */
function MatchLines({
  match,
  playerUrls,
}: Readonly<{
  match: WaidcupLiveMatch;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  const { t } = useI18n();
  const has1 = match.side1Names.length > 0;
  const has2 = match.side2Names.length > 0;
  if (!has1 && !has2) {
    return <span className="oopt__match oopt__match--tbd">{tbdLabel(match, t)}</span>;
  }
  return (
    <span className="oopt__match">
      {has1 ? (
        <MatchSide names={match.side1Names} side="a" winner={match.winnerSide === 1} playerUrls={playerUrls} />
      ) : (
        <span className="oopt__player oopt__tbd">tbd</span>
      )}
      <span className="oopt__vs">vs</span>
      {has2 ? (
        <MatchSide names={match.side2Names} side="b" winner={match.winnerSide === 2} playerUrls={playerUrls} />
      ) : (
        <span className="oopt__player oopt__tbd">tbd</span>
      )}
      <MatchFooter match={match} />
    </span>
  );
}

/** Zeile unter dem Matchup: Ergebnis, sobald vorhanden – sonst die Runde
 *  („Event Runde"), solange die Partie noch offen ist. */
function MatchFooter({ match }: Readonly<{ match: WaidcupLiveMatch }>): JSX.Element | null {
  const { t } = useI18n();
  if (match.result !== "") {
    return <span className="oopt__result">{match.result}</span>;
  }
  const round = roundLine(match, t);
  if (round !== "") {
    return <span className="oopt__round">{round}</span>;
  }
  return null;
}

function courtNumber(court: string): number {
  return Number(/\d+/.exec(court)?.[0] ?? 0);
}

/**
 * Raster (Zeiten × Plätze) aus den Tagesmatches aufbauen.
 *
 * `occupiedOnly` (Kiosk): nur tatsächlich bespielte Plätze als Spalten – leere
 * Plätze fallen ganz weg, sodass die belegten den Platz voll nutzen. Standard
 * (Web/E-Mail): feste Spalten 1…max(6, höchster Platz), damit das Layout stabil
 * bleibt und der E-Mail-Export unverändert bleibt.
 */
export function buildGrid(
  matches: WaidcupLiveMatch[],
  options: Readonly<{ occupiedOnly?: boolean }> = {},
): Grid {
  const times = [...new Set(matches.map((m) => m.scheduledTime))].sort((a, b) => a.localeCompare(b));
  const courts = options.occupiedOnly
    ? [...new Set(matches.map((m) => courtNumber(m.court)))].filter((c) => c > 0).sort((a, b) => a - b)
    : Array.from({ length: Math.max(6, ...matches.map((m) => courtNumber(m.court))) }, (_, i) => i + 1);
  const byKey = new Map<string, WaidcupLiveMatch>();
  for (const m of matches) {
    const key = `${courtNumber(m.court)}|${m.scheduledTime}`;
    if (!byKey.has(key)) byKey.set(key, m);
  }
  return { times, courts, byKey };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDateIso(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * Die zeitlich gerade „laufende" Zeit-Band-Zeile: die letzte Startzeit <= jetzt –
 * aber nur, wenn der angezeigte Tag wirklich heute ist. Sonst null (kein Ball).
 */
export function currentBandTime(times: string[], dayIso: string | undefined, now: Date): string | null {
  if (!dayIso || dayIso !== localDateIso(now)) return null;
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  let current: string | null = null;
  for (const time of times) {
    if (time <= hhmm) current = time;
    else break;
  }
  return current;
}

/** ISO-Datum → „Freitag, 3. Juli 2026" (Locale des Nutzers). */
export function formatDate(iso: string | undefined, language: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!p) return "";
  return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3])).toLocaleDateString(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

/** Eine Tabelle rendern – theme-angepasst (CSS-Klassen) oder mit den festen
 *  E-Mail-Inline-Styles. `currentTime` markiert (nur ohne email) die aktuelle
 *  Zeitzeile mit Tennisball. */
export function ScheduleTable({
  grid,
  email,
  playerUrls,
  currentTime = null,
}: Readonly<{
  grid: Grid;
  email: boolean;
  playerUrls?: Record<string, string>;
  currentTime?: string | null;
}>): JSX.Element {
  const { t } = useI18n();
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
              {t("live.court", { number: c })}
            </td>
          ))}
        </tr>
        {times.map((time) => (
          <ScheduleTimeBlock
            key={time}
            time={time}
            courts={courts}
            byKey={byKey}
            email={email}
            current={!email && time === currentTime}
            cls={cls}
            st={st}
            playerUrls={playerUrls}
          />
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
  current,
  cls,
  st,
  playerUrls,
}: Readonly<{
  time: string;
  courts: number[];
  byKey: Map<string, WaidcupLiveMatch>;
  email: boolean;
  current: boolean;
  cls: (name: string) => string | undefined;
  st: (name: keyof typeof EMAIL) => CSSProperties | undefined;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  const { t, language } = useI18n();
  const bandClass = current ? "oopt__band oopt__band--current" : "oopt__band";
  return (
    <>
      <tr>
        <td className={cls(bandClass)} style={st("band")} colSpan={courts.length}>
          {current ? <span className="oopt__ball" aria-hidden="true">🎾 </span> : null}
          {formatTimeBand(time, language)}
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
              {email ? matchText(match, t) : <MatchLines match={match} playerUrls={playerUrls} />}
            </td>
          );
        })}
      </tr>
    </>
  );
}
