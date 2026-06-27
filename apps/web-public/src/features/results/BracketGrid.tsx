/**
 * Visuelles Auf-/Abstiegs-Bracket aus dem DrawResults-Grid. Bracket-Linien
 * kommen aus border-bottom/right; Score-Zellen sind klickbar.
 */
import type { JSX } from "react";
import type { BracketCell, BracketResponse, ResultType } from "@tcw/shared";
import { useI18n } from "../../i18n/I18nProvider.js";

function cellClassName(cell: BracketCell | null): string {
  const classes = ["bracket-cell"];
  if (cell?.borderBottom) classes.push("bracket-cell--bottom");
  if (cell?.borderRight) classes.push("bracket-cell--right");
  return classes.join(" ");
}

function CellContent({
  cell,
  onOpenEncount,
}: {
  cell: BracketCell;
  onOpenEncount: (encountId: number, type: ResultType) => void;
}): JSX.Element | null {
  const { t, translateKnown } = useI18n();

  if (cell.kind === "team") {
    const classes = ["bracket-team"];
    if (cell.isOwn) classes.push("bracket-team--own");
    if (cell.isPending) classes.push("bracket-team--pending");
    return (
      <span className={classes.join(" ")}>
        {cell.isHome ? "* " : ""}
        {translateKnown(cell.text)}
      </span>
    );
  }
  if (cell.kind === "result") {
    if (cell.encountId > 0) {
      return (
        <button
          type="button"
          className="bracket-score"
          onClick={() => onOpenEncount(cell.encountId, cell.resultType)}
        >
          {cell.text || t("common.details")}
        </button>
      );
    }
    return <span className="bracket-score-static">{cell.text}</span>;
  }
  return <span className="bracket-text">{cell.text}</span>;
}

export function BracketGrid({
  bracket,
  onOpenEncount,
}: {
  bracket: BracketResponse;
  onOpenEncount: (encountId: number, type: ResultType) => void;
}): JSX.Element {
  const { t } = useI18n();
  if (bracket.rows === 0) {
    return <div className="state">{t("results.noBracket")}</div>;
  }
  return (
    <div className="bracket-wrap">
      <table className="bracket-table">
        <tbody>
          {bracket.grid.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td key={colIndex} className={cellClassName(cell)}>
                  {cell ? <CellContent cell={cell} onOpenEncount={onOpenEncount} /> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{t("results.homeMarkerRemark")}</p>
    </div>
  );
}
