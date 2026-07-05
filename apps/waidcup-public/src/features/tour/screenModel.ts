/**
 * Reine Model-Builder für die vier In-World-Screens der 3D-Tour. Sie liefern
 * ein layout-neutrales ScreenModel (Text- oder Tabellen-Tafel), das der
 * Canvas-Painter zeichnet. Keine DOM-/Canvas-Abhängigkeit -> unit-testbar.
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

export interface ScreenModel {
  title: string;
  theme: "dark" | "light";
  layout: "text" | "table";
  textLines?: TextLine[];
  columns?: TableColumn[];
  rows?: string[][];
  note?: string;
}

/** Spalten der Match-Tafeln (x in Canvas-Pixeln bei 1024 Breite, 48 Rand). */
export const BOARD_COLUMNS: TableColumn[] = [
  { header: "kiosk.colCourt", x: 48 },
  { header: "kiosk.colTime", x: 168 },
  { header: "kiosk.colMatch", x: 300 },
  { header: "kiosk.colEvent", x: 760 },
];

export const MAX_TABLE_ROWS = 9;

function matchup(m: WaidcupLiveMatch): string {
  return `${m.side1Names.join("/")} vs ${m.side2Names.join("/")}`;
}

function matchRow(m: WaidcupLiveMatch): string[] {
  return [m.court, m.scheduledTime, matchup(m), m.eventName];
}

function tableModel(title: string, theme: "dark" | "light", matches: WaidcupLiveMatch[], t: Translate): ScreenModel {
  const columns = BOARD_COLUMNS.map((c) => ({ ...c, header: t(c.header) }));
  if (matches.length === 0) {
    return { title, theme, layout: "table", columns, rows: [], note: t("orderOfPlay.empty") };
  }
  const rows = matches.slice(0, MAX_TABLE_ROWS).map(matchRow);
  const overflow = matches.length - rows.length;
  return { title, theme, layout: "table", columns, rows, note: overflow > 0 ? `+${overflow}` : undefined };
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
  return { title: t("nav.location"), theme: "dark", layout: "text", textLines };
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
  ];
  return { title: t("nav.infos"), theme: "dark", layout: "text", textLines };
}

export function buildOrderOfPlayModel(matches: WaidcupLiveMatch[], t: Translate): ScreenModel {
  return tableModel(t("nav.orderOfPlay"), "dark", matches, t);
}

export function buildLiveModel(live: WaidcupLiveResponse, t: Translate): ScreenModel {
  return tableModel(t("nav.live"), "light", [...live.now, ...live.upcoming], t);
}
