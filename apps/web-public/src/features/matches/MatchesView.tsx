/**
 * Spieltermine: Rundenfilter, Playoff-Badges, Hervorhebung des eigenen Clubs
 * und Verlinkung der Begegnungen auf Swisstennis.
 */
import { useMemo, useState, type JSX } from "react";
import type { MatchesResponse, ResultType, ScheduledMatch } from "@tcw/shared";
import type { ResourceState } from "../../api/useResource.js";
import { ClubName } from "../../components/ClubName.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { clubResultUrl } from "../../lib/swisstennisLinks.js";

type OpenEncount = (encountId: number, year: string, type: ResultType) => void;

function distinctRounds(matches: ScheduledMatch[]): string[] {
  const rounds = new Set(matches.map((match) => match.round).filter((round) => round !== ""));
  return [...rounds].sort((a, b) => Number(a) - Number(b));
}

function PlayoffBadge({ match }: Readonly<{ match: ScheduledMatch }>): JSX.Element | null {
  const { t } = useI18n();
  if (!match.playoff) {
    return null;
  }
  const variant =
    match.playoffType === "promotion"
      ? "promotion"
      : match.playoffType === "relegation"
        ? "relegation"
        : "neutral";
  const label =
    match.playoffType === "promotion"
      ? t("results.promotion")
      : match.playoffType === "relegation"
        ? t("results.relegation")
        : t("matches.playoffBadge");
  return <span className={`badge badge--${variant}`}> {label}</span>;
}

function ResultCell({ match, onOpenEncount }: Readonly<{ match: ScheduledMatch; onOpenEncount: OpenEncount }>): JSX.Element {
  const { t } = useI18n();
  const isClickable = match.encountId > 0 && match.validated;
  if (!isClickable) {
    return <span className="numeric">{match.result || t("common.none")}</span>;
  }
  const type: ResultType = match.playoff ? "tableau" : "encount";
  return (
    <button
      type="button"
      className="link-btn"
      onClick={() => onOpenEncount(match.encountId, match.year, type)}
      title={t("common.openEncounter")}
    >
      {match.result || t("common.details")}
    </button>
  );
}

export function MatchesView({
  state,
  onOpenEncount,
}: Readonly<{
  state: ResourceState<MatchesResponse>;
  onOpenEncount: OpenEncount;
}>): JSX.Element {
  const { t, translateKnown } = useI18n();
  return (
    <section>
      <ResourceView state={state} errorKey="matches.loadError">
        {(data) => (
          <MatchesTable
            data={data}
            translate={t}
            translateKnown={translateKnown}
            onOpenEncount={onOpenEncount}
          />
        )}
      </ResourceView>
    </section>
  );
}

function MatchesTable({
  data,
  translate,
  translateKnown,
  onOpenEncount,
}: Readonly<{
  data: MatchesResponse;
  translate: (key: string, params?: Record<string, string | number>) => string;
  translateKnown: (value: string) => string;
  onOpenEncount: OpenEncount;
}>): JSX.Element {
  const rounds = useMemo(() => distinctRounds(data.matches), [data.matches]);
  const [activeRound, setActiveRound] = useState<string>(rounds[0] ?? "");

  const visibleMatches = data.matches.filter(
    (match) => activeRound === "" || match.round === activeRound,
  );

  return (
    <>
      <div className="tabs-with-action">
        <div className="scroll-row" role="tablist">
          {rounds.map((round) => (
            <button
              key={round}
              type="button"
              role="tab"
              className={`chip${round === activeRound ? " is-active" : ""}`}
              aria-pressed={round === activeRound}
              onClick={() => setActiveRound(round)}
            >
              {translate("matches.round", { round })}
            </button>
          ))}
        </div>
        <a className="link-btn" href={clubResultUrl()} target="_blank" rel="noopener noreferrer">
          {translate("matches.swisstennisLink")}
        </a>
      </div>

      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>{translate("matches.date")}</th>
              <th className="numeric">{translate("matches.time")}</th>
              <th>{translate("matches.league")}</th>
              <th>{translate("matches.homeTeam")}</th>
              <th>{translate("matches.awayTeam")}</th>
              <th className="numeric">{translate("matches.result")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleMatches.map((match, index) => (
              <tr key={`${match.encountId}-${index}`} className={match.isHomeOwn ? "is-own" : ""}>
                <td>{match.date || translate("common.none")}</td>
                <td className="numeric">{match.time}</td>
                <td>
                  {translateKnown(match.liga)}
                  <PlayoffBadge match={match} />
                </td>
                <td>
                  <ClubName name={match.home} />
                </td>
                <td>
                  <ClubName name={match.away} />
                </td>
                <td className="numeric">
                  <ResultCell match={match} onOpenEncount={onOpenEncount} />
                </td>
              </tr>
            ))}
            {visibleMatches.length === 0 ? (
              <tr>
                <td colSpan={6} className="state">
                  {translate("results.noResults")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
