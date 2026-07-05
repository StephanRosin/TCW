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

export interface ScreenModel {
  title: string;
  theme: "light" | "dark";
  layout: "text" | "table";
  textLines?: TextLine[];
  sections?: TableSection[];
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
  const digits = court.match(/\d+/);
  return digits ? Number(digits[0]) : Number.MAX_SAFE_INTEGER;
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
  ];
  return { title: t("nav.infos"), theme: "light", layout: "text", textLines };
}

export function buildOrderOfPlayModel(live: WaidcupLiveResponse, t: Translate): ScreenModel {
  return buildBoard(t("nav.orderOfPlay"), BOARD_COLUMNS, live, t);
}

export function buildLiveModel(live: WaidcupLiveResponse, t: Translate): ScreenModel {
  return buildBoard(t("nav.live"), BOARD_COLUMNS, live, t);
}
