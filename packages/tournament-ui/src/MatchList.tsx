/**
 * Liste ausgeloster Turnier-Partien: Tableau-Spalte, Gewinnerseite fett,
 * Doppelspieler untereinander. Reihenfolge über `order` steuerbar
 * (siehe matchOrder.ts); Partien ohne Datum stehen immer zuletzt.
 */
import { useMemo, type JSX } from "react";
import type { TournamentMatch } from "@tcw/shared";
import { useI18n } from "./I18nProvider.js";
import { sortTournamentMatches, type MatchListOrder } from "./matchOrder.js";
import { PlayerLink } from "./PlayerLink.js";
import { translateRound } from "./roundLabel.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatDate(match: TournamentMatch, noDateLabel: string): string {
  if (match.scheduledDate === "") {
    return noDateLabel;
  }
  const match2 = match.scheduledDate.match(ISO_DATE);
  const date = match2 ? `${match2[3]}.${match2[2]}.${match2[1]}` : match.scheduledDate;
  return [date, match.scheduledTime, match.court].filter((part) => part !== "").join(" · ");
}

function SideCell({
  names,
  isWinner,
  playerUrls,
}: Readonly<{
  names: string[];
  isWinner: boolean;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  return (
    <div className={isWinner ? "match-side match-side--winner" : "match-side"}>
      {names.map((name) => (
        <div key={name} className="match-player">
          <PlayerLink name={name} playerUrls={playerUrls} />
        </div>
      ))}
    </div>
  );
}

export function MatchList({
  matches,
  order = "playedFirst",
  playerUrls,
}: Readonly<{
  matches: TournamentMatch[];
  order?: MatchListOrder;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(() => sortTournamentMatches(matches, order), [matches, order]);

  if (matches.length === 0) {
    return <div className="state">{t("tournaments.noMatches")}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th>{t("tournaments.tableau")}</th>
            <th>{t("tournaments.round")}</th>
            <th>{t("tournaments.player1")}</th>
            <th>{t("tournaments.player2")}</th>
            <th className="numeric">{t("matches.result")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((match) => {
            const round = [translateRound(match.roundName, t), match.poolName]
              .filter((part, index, all) => part !== "" && all.indexOf(part) === index)
              .join(" · ");
            // Eine Partie hat entweder ein Resultat (gespielt) ODER einen Termin
            // (noch offen) – daher eine Spalte: Resultat, sonst Datum/Zeit/Platz.
            return (
              <tr key={match.matchKey}>
                <td>{match.eventName}</td>
                <td>{round}</td>
                <td>
                  <SideCell names={match.side1Names} isWinner={match.winnerSide === 1} playerUrls={playerUrls} />
                </td>
                <td>
                  <SideCell names={match.side2Names} isWinner={match.winnerSide === 2} playerUrls={playerUrls} />
                </td>
                <td className="numeric">{match.result || formatDate(match, t("tournaments.noDate"))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
