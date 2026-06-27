/**
 * Ergebnisse: Jahresauswahl mit jahresspezifischen Teams, Gruppenphase
 * (Rangliste + Resultate), Auf-/Abstiegs-Bracket und Begegnungsdetail.
 *
 * Wichtig: Das Detailjahr stammt immer aus der konkreten Begegnung (bzw. dem
 * angeklickten Spieltermin), nicht aus dem aktiven Ergebnis-Jahr.
 */
import { useEffect, useState, type JSX } from "react";
import {
  RESULTS_YEARS,
  type ResultsTeam,
  type ResultType,
  type TeamResultsResponse,
} from "@tcw/shared";
import type { ResultsApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { DataView } from "../../components/DataView.js";
import { ClubName } from "../../components/ClubName.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { BracketGrid } from "./BracketGrid.js";
import { EncountDetail, type EncountRef } from "./EncountDetail.js";

const CURRENT_YEAR = String(new Date().getFullYear());
const DEFAULT_YEAR = (RESULTS_YEARS as readonly string[]).includes(CURRENT_YEAR)
  ? CURRENT_YEAR
  : RESULTS_YEARS[0];

type OpenEncount = (encountId: number, year: string, type: ResultType) => void;

function YearTabs({ year, onSelect }: { year: string; onSelect: (year: string) => void }): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="scroll-row" role="tablist" aria-label={t("results.yearSelect")}>
      {RESULTS_YEARS.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          className={`chip${option === year ? " is-active" : ""}`}
          aria-pressed={option === year}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TeamPicker({
  teams,
  activeTeamId,
  onSelect,
}: {
  teams: ResultsTeam[];
  activeTeamId: number | null;
  onSelect: (teamId: number) => void;
}): JSX.Element {
  const { translateKnown } = useI18n();
  // Geschlechtszeilen ohne Label – die Buttons enthalten bereits "Damen"/"Herren".
  const genders: Array<ResultsTeam["gender"]> = ["Damen", "Herren"];
  return (
    <div className="team-picker">
      {genders.map((gender) => {
        const groupTeams = teams.filter((team) => team.gender === gender);
        if (groupTeams.length === 0) {
          return null;
        }
        return (
          <div key={gender} className="scroll-row">
            {groupTeams.map((team) => (
              <button
                key={team.teamId}
                type="button"
                className={`chip${team.teamId === activeTeamId ? " is-active" : ""}`}
                aria-pressed={team.teamId === activeTeamId}
                onClick={() => onSelect(team.teamId)}
              >
                {translateKnown(team.label)}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ResultsTable({
  matches,
  year,
  onOpenEncount,
}: {
  matches: TeamResultsResponse["matches"];
  year: string;
  onOpenEncount: OpenEncount;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <div>
      <h4 className="results-subhead">{t("results.results")}</h4>
      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>{t("results.round")}</th>
              <th>{t("results.date")}</th>
              <th>{t("results.encounter")}</th>
              <th>{t("matches.result")}</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.encountId} className={match.homeIsOwn || match.awayIsOwn ? "is-own" : ""}>
                <td className="numeric">{match.round}</td>
                <td>{match.date}</td>
                <td>
                  <ClubName name={match.home} /> – <ClubName name={match.away} />
                </td>
                <td className="numeric">
                  {match.validated && match.encountId > 0 ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onOpenEncount(match.encountId, year, "encount")}
                    >
                      {match.result}
                    </button>
                  ) : (
                    <span>{match.result || t("common.none")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: TeamResultsResponse["standings"] }): JSX.Element {
  const { t } = useI18n();
  return (
    <div>
      <h4 className="results-subhead">{t("results.standings")}</h4>
      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>{t("results.rank")}</th>
              <th>{t("results.team")}</th>
              <th>{t("results.points")}</th>
              <th>{t("results.sets")}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.rank} className={row.isOwn ? "is-own" : ""}>
                <td className="numeric">{row.rank}</td>
                <td>
                  <ClubName name={row.teamName} />
                </td>
                <td className="numeric">{row.points}</td>
                <td className="numeric">{row.sets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupResults({
  data,
  year,
  onOpenEncount,
}: {
  data: TeamResultsResponse;
  year: string;
  onOpenEncount: OpenEncount;
}): JSX.Element {
  return (
    <div className="results-columns">
      <ResultsTable matches={data.matches} year={year} onOpenEncount={onOpenEncount} />
      <StandingsTable standings={data.standings} />
    </div>
  );
}

function BracketPanel({
  api,
  ligueId,
  promotion,
  year,
  onOpenEncount,
}: {
  api: ResultsApi;
  ligueId: number;
  promotion: 0 | 1;
  year: string;
  onOpenEncount: OpenEncount;
}): JSX.Element {
  const state = useResource(() => api.draw(ligueId, promotion, year), [api, ligueId, promotion, year]);
  return (
    <DataView state={state} errorKey="results.loadError">
      {(bracket) => (
        <BracketGrid bracket={bracket} onOpenEncount={(id, type) => onOpenEncount(id, year, type)} />
      )}
    </DataView>
  );
}

function TeamResultsPanel({
  api,
  teamId,
  year,
  onOpenEncount,
}: {
  api: ResultsApi;
  teamId: number;
  year: string;
  onOpenEncount: OpenEncount;
}): JSX.Element {
  const { t, translateKnown } = useI18n();
  const state = useResource(() => api.team(teamId, year), [api, teamId, year]);
  const [tab, setTab] = useState<"group" | "bracket">("group");

  useEffect(() => {
    setTab("group");
  }, [teamId, year]);

  return (
    <DataView state={state} errorKey="results.loadError">
      {(data) => {
        const title = data.liga
          ? `${translateKnown(data.liga)}${data.group ? ` – ${t("teams.group", { group: data.group })}` : ""}`
          : t("results.title");
        return (
        <div>
          <div className="results-head">
            <h3 className="results-subtitle">{title}</h3>
            <div className="subtabs subtabs--inline" role="tablist">
              <button
                type="button"
                role="tab"
                className="subtabs__btn"
                aria-selected={tab === "group"}
                onClick={() => setTab("group")}
              >
                {t("results.groupPhase")}
              </button>
              {data.bracket ? (
                <button
                  type="button"
                  role="tab"
                  className="subtabs__btn"
                  aria-selected={tab === "bracket"}
                  onClick={() => setTab("bracket")}
                >
                  {data.bracket.type === "promotion" ? t("results.promotion") : t("results.relegation")}
                </button>
              ) : null}
            </div>
          </div>

          {tab === "group" || !data.bracket ? (
            <GroupResults data={data} year={year} onOpenEncount={onOpenEncount} />
          ) : (
            <BracketPanel
              api={api}
              ligueId={data.bracket.ligueId}
              promotion={data.bracket.promotion}
              year={year}
              onOpenEncount={onOpenEncount}
            />
          )}
        </div>
        );
      }}
    </DataView>
  );
}

interface ResultsViewProps {
  api: ResultsApi;
  pendingEncounter: EncountRef | null;
  onConsumePending: () => void;
  onBackToMatches: () => void;
}

export function ResultsView({
  api,
  pendingEncounter,
  onConsumePending,
  onBackToMatches,
}: ResultsViewProps): JSX.Element {
  const { t } = useI18n();
  const [year, setYear] = useState<string>(DEFAULT_YEAR);
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EncountRef | null>(null);
  const [detailFromMatches, setDetailFromMatches] = useState(false);

  const teamsState = useResource(() => api.teams(year), [api, year]);

  useEffect(() => {
    if (pendingEncounter) {
      setDetail(pendingEncounter);
      setDetailFromMatches(true);
      onConsumePending();
    }
  }, [pendingEncounter, onConsumePending]);

  useEffect(() => {
    if (teamsState.status === "ready") {
      const exists = teamsState.data.items.some((team) => team.teamId === activeTeamId);
      if (!exists) {
        setActiveTeamId(teamsState.data.items[0]?.teamId ?? null);
      }
    }
  }, [teamsState, activeTeamId]);

  const openEncount: OpenEncount = (encountId, encountYear, type) => {
    setDetailFromMatches(false);
    setDetail({ encountId, year: encountYear, type });
  };

  const handleBack = (): void => {
    setDetail(null);
    if (detailFromMatches) {
      onBackToMatches();
    }
  };

  if (detail) {
    return (
      <section>
        <EncountDetail api={api} encountRef={detail} onBack={handleBack} />
      </section>
    );
  }

  return (
    <section>
      <YearTabs year={year} onSelect={setYear} />
      <DataView state={teamsState} errorKey="results.loadError">
        {(data) =>
          data.items.length === 0 ? (
            <div className="state">{t("results.noTeams")}</div>
          ) : (
            <>
              <TeamPicker teams={data.items} activeTeamId={activeTeamId} onSelect={setActiveTeamId} />
              {activeTeamId !== null ? (
                <TeamResultsPanel
                  api={api}
                  teamId={activeTeamId}
                  year={year}
                  onOpenEncount={openEncount}
                />
              ) : null}
            </>
          )
        }
      </DataView>
    </section>
  );
}
