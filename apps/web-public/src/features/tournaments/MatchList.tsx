/**
 * Liste ausgeloster Turnier-Partien: Tableau-Spalte, Gewinnerseite fett,
 * Doppelspieler untereinander. Sortierung in drei Gruppen: gespielte Partien
 * zuerst (neueste oben), dann anstehende mit Datum (nächste zuerst), zuletzt
 * Partien ohne Datum.
 */
import { useMemo, type JSX } from "react";
import type { TournamentMatch } from "@tcw/shared";
import { useI18n } from "../../i18n/I18nProvider.js";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function matchTimestamp(match: TournamentMatch): string {
  return `${match.scheduledDate}T${match.scheduledTime || "00:00"}`;
}

/** Sortiergruppe: 0 = gespielt, 1 = anstehend (mit Datum), 2 = ohne Datum. */
function matchGroup(match: TournamentMatch): number {
  if (match.status === "played") return 0;
  return match.scheduledDate !== "" ? 1 : 2;
}

/** Gespielt zuerst (neueste oben), dann anstehend (nächste oben), dann ohne Datum. */
function compareMatchOrder(a: TournamentMatch, b: TournamentMatch): number {
  const groupA = matchGroup(a);
  const groupB = matchGroup(b);
  if (groupA !== groupB) {
    return groupA - groupB;
  }
  if (groupA === 2) {
    return 0;
  }
  const timestampA = matchTimestamp(a);
  const timestampB = matchTimestamp(b);
  return groupA === 0
    ? timestampB.localeCompare(timestampA)
    : timestampA.localeCompare(timestampB);
}

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

export function MatchList({ matches }: { matches: TournamentMatch[] }): JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(() => [...matches].sort(compareMatchOrder), [matches]);

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
            <th>{t("matches.result")}</th>
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
