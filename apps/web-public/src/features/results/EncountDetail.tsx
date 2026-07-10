/**
 * Begegnungsdetail: Einzel- und Doppeltabellen mit Klassierungen, Gewinner
 * fett, Walkover als "w.o.", Link zu Swisstennis (nur hier, nicht in der Liste).
 */
import type { JSX } from "react";
import type { EncountDetailResponse, EncountMatch, ResultType } from "@tcw/shared";
import type { ResultsApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";

export interface EncountRef {
  encountId: number;
  year: string;
  type: ResultType;
}

function SideNames({ names, state }: Readonly<{ names: string[]; state: "winner" | "loser" | "neutral" }>): JSX.Element {
  return (
    <div className="encount-side">
      {names.map((name) => (
        <div key={name} className={`encount-player encount-player--${state}`}>
          {name}
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match }: Readonly<{ match: EncountMatch }>): JSX.Element {
  const homeOutcome = match.homeWon ? "winner" : "loser";
  const awayOutcome = match.homeWon ? "loser" : "winner";
  const homeState = match.homeWon === null ? "neutral" : homeOutcome;
  const awayState = match.homeWon === null ? "neutral" : awayOutcome;
  return (
    <tr>
      <td className="numeric">{match.position}</td>
      <td>
        <SideNames names={match.homeNames} state={homeState} />
      </td>
      <td>
        <SideNames names={match.awayNames} state={awayState} />
      </td>
      <td className={`numeric${match.walkover ? " encount-walkover" : ""}`}>{match.score}</td>
    </tr>
  );
}

function MatchTable({
  title,
  matches,
  homeTeam,
  awayTeam,
}: Readonly<{
  title: string;
  matches: EncountMatch[];
  homeTeam: string;
  awayTeam: string;
}>): JSX.Element | null {
  const { t } = useI18n();
  if (matches.length === 0) {
    return null;
  }
  return (
    <div className="encount-block">
      <h3 className="encount-block__title">{title}</h3>
      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr>
              <th className="numeric">{t("common.position")}</th>
              <th>{homeTeam}</th>
              <th>{awayTeam}</th>
              <th className="numeric">{t("matches.result")}</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <MatchRow key={match.position} match={match} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailContent({ detail }: Readonly<{ detail: EncountDetailResponse }>): JSX.Element {
  const { t, translateKnown } = useI18n();
  return (
    <div className="encount">
      <div className="encount-header">
        <div className="encount-header__teams">
          <span className="club-own-maybe">{detail.homeTeam}</span>
          <span className="encount-header__score">{detail.totalResult}</span>
          <span>{detail.awayTeam}</span>
        </div>
        <div className="encount-header__meta">
          {[detail.date, translateKnown(detail.liga), detail.group && t("teams.group", { group: detail.group })]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <a className="link-btn" href={detail.swisstennisUrl} target="_blank" rel="noopener noreferrer">
          {t("results.openSwisstennis")}
        </a>
      </div>
      <MatchTable
        title={t("results.singles")}
        matches={detail.singles}
        homeTeam={detail.homeTeam}
        awayTeam={detail.awayTeam}
      />
      <MatchTable
        title={t("results.doubles")}
        matches={detail.doubles}
        homeTeam={detail.homeTeam}
        awayTeam={detail.awayTeam}
      />
    </div>
  );
}

export function EncountDetail({
  api,
  encountRef,
  onBack,
}: Readonly<{
  api: ResultsApi;
  encountRef: EncountRef;
  onBack: () => void;
}>): JSX.Element {
  const { t } = useI18n();
  const state = useResource(
    () => api.encount(encountRef.encountId, encountRef.year, encountRef.type),
    [api, encountRef.encountId, encountRef.year, encountRef.type],
  );

  return (
    <div>
      <button type="button" className="link-btn" onClick={onBack}>
        {t("common.back")}
      </button>
      <ResourceView state={state} errorKey="results.encounterLoadError">
        {(detail) => <DetailContent detail={detail} />}
      </ResourceView>
    </div>
  );
}
