/**
 * Reine Model-Builder für die vier In-World-Screens der 3D-Tour. Sie liefern
 * ein layout-neutrales ScreenModel (Text- oder Tabellen-Tafel), das der
 * Canvas-Painter zeichnet. Keine DOM-/Canvas-Abhängigkeit -> unit-testbar.
 *
 * Alle Screens werden im Light-Mode gezeichnet. Tabellen-Screens sind in
 * Sektionen unterteilt ("Jetzt"/"Danach"), jede Sektion nach Platz sortiert.
 */
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import { WAIDCUP_ADDRESS_LINES } from "./address.js";

type Translate = (key: string) => string;

export interface TextLine {
  text: string;
  emphasis?: boolean;
}

export interface TableColumn {
  header: string;
  x: number;
}

export interface TableSection {
  heading: string;
  columns: TableColumn[];
  rows: string[][];
  note?: string;
}

/** Ein Zeitblock im Order-of-Play-Raster: pro Court die Match-Zeilen oder null (leer). */
export interface OopBlock {
  time: string;
  cells: (string[] | null)[];
}

/** Raster-Modell des Order-of-Play-Screens (wie in der Web-UI: Courts × Zeiten). */
export interface OopGrid {
  subtitle: string;
  courts: number[];
  blocks: OopBlock[];
  empty?: string;
}

export interface ScreenModel {
  title: string;
  theme: "light" | "dark";
  layout: "text" | "table" | "grid";
  textLines?: TextLine[];
  sections?: TableSection[];
  grid?: OopGrid;
}

/**
 * Board-Spalten bei 1000px Canvasbreite (48 Rand): Platz, Uhrzeit, Match. Die
 * Match-Spalte nutzt die volle Restbreite (kein Kategorie-Feld), damit die
 * Namen ausgeschrieben Platz haben – für Order of Play wie für Live.
 */
export const BOARD_COLUMNS: TableColumn[] = [
  { header: "kiosk.colCourt", x: 48 },
  { header: "kiosk.colTime", x: 160 },
  { header: "kiosk.colMatch", x: 300 },
];

export const MAX_SECTION_ROWS = 6;

/**
 * Matchup-Text. Einzel bleibt einzeilig ("A vs B"); Doppel wird zweizeilig
 * (ein Paar pro Zeile), damit die vier Namen nicht abgeschnitten werden. Der
 * Zeilenumbruch ("\n") wird vom Painter interpretiert.
 */
function matchup(m: WaidcupLiveMatch): string {
  const side1 = m.side1Names.join(" / ");
  const side2 = m.side2Names.join(" / ");
  const isDoubles = m.side1Names.length > 1 || m.side2Names.length > 1;
  return isDoubles ? `${side1}\nvs ${side2}` : `${side1} vs ${side2}`;
}

function matchRow(m: WaidcupLiveMatch): string[] {
  return [m.court, m.scheduledTime, matchup(m)];
}

/** Platznummer aus dem Platz-String ("Platz 2" -> 2), für die 1-6-Sortierung. */
function courtSortKey(court: string): number {
  const digits = /\d+/.exec(court);
  return digits ? Number(digits[0]) : Number.MAX_SAFE_INTEGER;
}

/** "Weiss Xenia (R5)" -> { label: "Weiss Xenia", ranking: "R5" }. */
function splitRanking(name: string): { label: string; ranking: string } {
  const m = /^(.*?)\(([^()]*)\)$/.exec(name.trim());
  return m ? { label: m[1]!.trim(), ranking: m[2]!.trim() } : { label: name.trim(), ranking: "" };
}

/** Ein Spieler als "(R5) Weiss Xenia" (mehrzeilige Anzeige wie in der Web-UI). */
function playerLine(name: string): string {
  const { label, ranking } = splitRanking(name);
  return ranking !== "" ? `(${ranking}) ${label}` : label;
}

/** Court-Nummer aus dem Platz-String. */
function courtNumber(court: string): number {
  return Number(/\d+/.exec(court)?.[0] ?? 0);
}

/** Match-Zelle wie in der Web-UI: jeder Spieler auf eigener Zeile, "vs" dazwischen. */
function matchCellLines(m: WaidcupLiveMatch): string[] {
  return [...m.side1Names.map(playerLine), "vs", ...m.side2Names.map(playerLine)];
}

/** ISO-Datum -> "Freitag, 3. Juli 2026" (Locale des Nutzers). */
function formatDate(iso: string | undefined, language: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!p) return "";
  return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3])).toLocaleDateString(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildSection(
  heading: string,
  columns: TableColumn[],
  matches: WaidcupLiveMatch[],
  t: Translate,
): TableSection {
  const sorted = [...matches].sort((a, b) => courtSortKey(a.court) - courtSortKey(b.court));
  if (sorted.length === 0) {
    return { heading, columns, rows: [], note: t("live.empty") };
  }
  const rows = sorted.slice(0, MAX_SECTION_ROWS).map(matchRow);
  const overflow = sorted.length - rows.length;
  return { heading, columns, rows, note: overflow > 0 ? `+${overflow}` : undefined };
}

/** Zwei Sektionen "Jetzt" (laufend) und "Danach" (als Nächstes) aus dem Live-Feed. */
function buildBoard(title: string, columns: TableColumn[], live: WaidcupLiveResponse, t: Translate): ScreenModel {
  const cols = columns.map((c) => ({ ...c, header: t(c.header) }));
  return {
    title,
    theme: "light",
    layout: "table",
    sections: [
      buildSection(t("board.now"), cols, live.now, t),
      buildSection(t("board.next"), cols, live.upcoming, t),
    ],
  };
}

export function buildLocationModel(t: Translate): ScreenModel {
  const textLines: TextLine[] = [
    ...WAIDCUP_ADDRESS_LINES.map((text) => ({ text, emphasis: true })),
    { text: "" },
    { text: t("location.transitTitle"), emphasis: true },
    { text: t("location.transitText") },
    { text: "" },
    { text: t("location.parkingTitle"), emphasis: true },
    { text: t("location.parkingText") },
  ];
  return { title: t("nav.location"), theme: "light", layout: "text", textLines };
}

export function buildInfosModel(t: Translate): ScreenModel {
  const textLines: TextLine[] = [
    { text: t("infos.dateDurationLabel"), emphasis: true },
    { text: t("infos.dateDurationValue") },
    { text: t("infos.dateFinalLabel"), emphasis: true },
    { text: t("infos.dateFinalValue") },
    { text: "" },
    { text: t("infos.tableauxTitle"), emphasis: true },
    { text: `${t("infos.tableau32")} · ${t("infos.tableau16")}` },
    { text: "" },
    { text: t("infos.hintsTitle"), emphasis: true },
    { text: t("infos.hint1") },
    { text: t("infos.hint4") },
    { text: t("infos.hint5") },
    { text: t("infos.hint6") },
    // hint8 + Merkblatt-Hinweis als Text (der PDF-Link ist auf der Wand nicht klickbar).
    { text: `${t("infos.hint8")} ${t("infos.hintPdf")}` },
  ];
  return { title: t("nav.infos"), theme: "light", layout: "text", textLines };
}

/**
 * Order of Play = Tagesspielplan als Raster wie in der Web-UI: Spalten = Courts,
 * je Uhrzeit ein Zeit-Band + eine Zeile mit den Matches pro Court (leere Slots
 * als „–"). Spieler mehrzeilig mit „(Rx)"-Prefix.
 */
export function buildOrderOfPlayModel(today: WaidcupLiveMatch[], t: Translate, language = "de-CH"): ScreenModel {
  const times = [...new Set(today.map((m) => m.scheduledTime))].sort((a, b) => a.localeCompare(b));
  const maxCourt = Math.max(6, ...today.map((m) => courtNumber(m.court)));
  const courts = Array.from({ length: maxCourt }, (_, i) => i + 1);
  const byKey = new Map<string, WaidcupLiveMatch>();
  for (const m of today) {
    const key = `${courtNumber(m.court)}|${m.scheduledTime}`;
    if (!byKey.has(key)) byKey.set(key, m);
  }
  const blocks: OopBlock[] = times.map((time) => ({
    time,
    cells: courts.map((c) => {
      const m = byKey.get(`${c}|${time}`);
      return m ? matchCellLines(m) : null;
    }),
  }));
  return {
    title: t("nav.orderOfPlay"),
    theme: "light",
    layout: "grid",
    grid: {
      subtitle: formatDate(today[0]?.scheduledDate, language),
      courts,
      blocks,
      empty: today.length === 0 ? t("orderOfPlay.empty") : undefined,
    },
  };
}

/** Live-Board: zwei Sektionen „Jetzt" (laufend) und „Danach" (als Nächstes). */
export function buildLiveModel(live: WaidcupLiveResponse, t: Translate): ScreenModel {
  return buildBoard(t("nav.live"), BOARD_COLUMNS, live, t);
}
