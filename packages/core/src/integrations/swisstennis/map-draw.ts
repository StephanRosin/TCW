/**
 * DrawResults → Bracket-Grid. Übernimmt Zelltypen (Team/Result/Text), die
 * Bracket-Linien (border-bottom/right) und das "*"-Heimteam-Kennzeichen.
 */
import { OWN_CLUB_NAME, type BracketCell, type BracketResponse, type ResultType } from "@tcw/shared";
import { asArray, cleanText, toNumber } from "./normalize.js";

interface RawText {
  Anchor?: number;
  content?: string;
  Link?: string;
}
interface RawCell {
  colNb?: number;
  rowNb?: number;
  roundNb?: number;
  Text?: RawText | string;
  "border-bottom"?: number;
  "border-right"?: number;
}

const ENCOUNT_ID_PATTERN = /EncountId=(\d+)/;

interface ParsedCell {
  rawContent: string;
  link: string;
  anchor: number | null;
  isTextObject: boolean;
}

function parseText(text: RawText | string | undefined): ParsedCell {
  if (text && typeof text === "object") {
    return {
      rawContent: cleanText(text.content ?? ""),
      link: text.Link ?? "",
      anchor: text.Anchor ?? null,
      isTextObject: true,
    };
  }
  return { rawContent: cleanText(text ?? ""), link: "", anchor: null, isTextObject: false };
}

function buildCell(raw: RawCell): BracketCell | null {
  const parsed = parseText(raw.Text);
  const borderBottom = raw["border-bottom"] === 1;
  const borderRight = raw["border-right"] === 1;
  const hasBorder = borderBottom || borderRight;
  if (parsed.rawContent === "" && !hasBorder) {
    return null;
  }

  const isTeamCell = raw.roundNb != null;
  const isResult = parsed.link.includes("EncountId=");
  const isTeam = isTeamCell || (parsed.isTextObject && parsed.anchor != null && !isResult);
  const displayName = parsed.rawContent.replace(/^\*/, "").trim();
  const encountMatch = ENCOUNT_ID_PATTERN.exec(parsed.link);
  const resultType: ResultType = parsed.link.includes("TableauResults") ? "tableau" : "encount";

  const kind = isTeam ? "team" : isResult ? "result" : "text";
  return {
    kind,
    text: isTeam ? displayName : parsed.rawContent,
    isHome: parsed.rawContent.startsWith("*"),
    isOwn: displayName === OWN_CLUB_NAME,
    isPending: isTeamCell && parsed.anchor == null,
    encountId: encountMatch ? Number(encountMatch[1]) : 0,
    resultType,
    borderBottom,
    borderRight,
  };
}

export function mapDrawResults(payload: unknown): BracketResponse {
  const table = (payload as { I2cm?: { DrawResults?: { Table?: unknown } } }).I2cm?.DrawResults
    ?.Table as { Row?: unknown; nbRows?: number; nbCols?: number } | undefined;
  const nbCols = toNumber(table?.nbCols);
  const nbRows = toNumber(table?.nbRows);
  if (!table || nbCols <= 0 || nbRows <= 0) {
    return { rows: 0, cols: 0, grid: [] };
  }

  const fullGrid: Array<Array<BracketCell | null>> = Array.from({ length: nbRows }, () =>
    Array.from({ length: nbCols }, () => null),
  );
  for (const row of asArray<{ Cell?: unknown }>(table.Row as never)) {
    for (const rawCell of asArray<RawCell>(row.Cell as never)) {
      const rowIndex = toNumber(rawCell.rowNb) - 1;
      const colIndex = toNumber(rawCell.colNb) - 1;
      if (rowIndex >= 0 && rowIndex < nbRows && colIndex >= 0 && colIndex < nbCols) {
        fullGrid[rowIndex]![colIndex] = buildCell(rawCell);
      }
    }
  }

  // Führende und abschließende komplett leere Zeilen entfernen (Geometrie bleibt erhalten).
  const hasContent = (cells: Array<BracketCell | null>): boolean => cells.some((cell) => cell !== null);
  const first = fullGrid.findIndex(hasContent);
  let last = fullGrid.length - 1;
  while (last >= 0 && !hasContent(fullGrid[last]!)) last -= 1;
  if (first < 0) {
    return { rows: 0, cols: nbCols, grid: [] };
  }
  const grid = fullGrid.slice(first, last + 1);
  return { rows: grid.length, cols: nbCols, grid };
}
