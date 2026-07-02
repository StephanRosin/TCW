/**
 * Liste ausgeloster Turnier-Partien: Tableau-Spalte, Gewinnerseite fett,
 * Doppelspieler untereinander. Reihenfolge über `order` steuerbar
 * (siehe matchOrder.ts); Partien ohne Datum stehen immer zuletzt.
 */
import { useMemo, type JSX } from "react";
import type { TournamentMatch } from "@tcw/shared";
import { useI18n } from "./I18nProvider.js";
import { compareTournamentMatches, type MatchListOrder } from "./matchOrder.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatDate(match: TournamentMatch, noDateLabel: string): string {
  if (match.scheduledDate === "") {
    return noDateLabel;
  }
  const match2 = match.scheduledDate.match(ISO_DATE);
  const date = match2 ? `${match2[3]}.${match2[2]}.${match2[1]}` : match.scheduledDate;
  return [date, match.scheduledTime, match.court].filter((part) => part !== "").join(" · ");
}

function SideCell({ names, isWinner }: { names: string[]; isWinner: boolean }): JSX.Element {
  return (
    <div className={isWinner ? "match-side match-side--winner" : "match-side"}>
      {names.map((name, index) => (
        <div key={index} className="match-player">
          {name}
        </div>
      ))}
    </div>
  );
}

export function MatchList({
  matches,
  order = "playedFirst",
}: {
  matches: TournamentMatch[];
  order?: MatchListOrder;
}): JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(() => [...matches].sort(compareTournamentMatches(order)), [matches, order]);

  if (matches.length === 0) {
    return <div className="state">{t("tournaments.noMatches")}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th>{t("tournaments.matchDate")}</th>
            <th>{t("tournaments.tableau")}</th>
            <th>{t("tournaments.round")}</th>
            <th>{t("tournaments.player1")}</th>
            <th>{t("tournaments.player2")}</th>
            <th className="numeric">{t("matches.result")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((match) => {
            const round = [match.roundName, match.poolName]
              .filter((part, index, all) => part !== "" && all.indexOf(part) === index)
              .join(" · ");
            return (
              <tr key={match.matchKey}>
                <td>{formatDate(match, t("tournaments.noDate"))}</td>
                <td>{match.eventName}</td>
                <td>{round}</td>
                <td>
                  <SideCell names={match.side1Names} isWinner={match.winnerSide === 1} />
                </td>
                <td>
                  <SideCell names={match.side2Names} isWinner={match.winnerSide === 2} />
                </td>
                <td className="numeric">{match.result || t("common.none")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
