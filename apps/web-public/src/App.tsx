/**
 * Wurzelkomponente der öffentlichen Seite: Mehrsprachigkeit, Hash-Routing,
 * Layout (Header, Navigation, Inhalt, Footer) und Auswahl der aktiven Ansicht.
 */
import { useCallback, useEffect, useState, type JSX } from "react";
import type { MatchesResponse, ResultType } from "@tcw/shared";
import { publicApi } from "./api/client.js";
import { useResource, type ResourceState } from "./api/useResource.js";
import { SiteHeader } from "./components/SiteHeader.js";
import { SiteFooter } from "./components/SiteFooter.js";
import { TabBar } from "./components/TabBar.js";
import { I18nProvider, useI18n } from "./i18n/I18nProvider.js";
import { useHashRoute } from "./app/useHashRoute.js";
import {
  DEFAULT_VIEW,
  isViewVisible,
  ratingsSubViewFromHash,
  viewFromHash,
  visibleNavItems,
  type MainView,
  type RatingsSubView,
} from "./app/navigation.js";
import { TeamsView } from "./features/teams/TeamsView.js";
import { TrainingView } from "./features/training/TrainingView.js";
import { MatchesView } from "./features/matches/MatchesView.js";
import { RatingsView } from "./features/ratings/RatingsView.js";
import { ResultsView } from "./features/results/ResultsView.js";
import { PlayerMatchesView } from "./features/player-matches/PlayerMatchesView.js";
import { TournamentsView } from "./features/tournaments/TournamentsView.js";
import { AgendaView } from "./features/agenda/AgendaView.js";
import type { EncountRef } from "./features/results/EncountDetail.js";

interface ViewState {
  view: MainView;
  ratingsSubView: RatingsSubView;
  matchesState: ResourceState<MatchesResponse>;
  pendingEncounter: EncountRef | null;
  navigate: (hash: string) => void;
  openEncounter: (encountId: number, year: string, type: ResultType) => void;
  consumePending: () => void;
}

const noop = (): void => {};

function ActiveView(state: ViewState): JSX.Element {
  switch (state.view) {
    case "teams":
      return <TeamsView />;
    case "training":
      return <TrainingView />;
    case "matches":
      return <MatchesView state={state.matchesState} onOpenEncount={state.openEncounter} />;
    case "ratings":
      return (
        <RatingsView
          subView={state.ratingsSubView}
          onSubViewChange={(subView) => state.navigate(subView)}
        />
      );
    case "results":
      return (
        <ResultsView
          api={publicApi.ic}
          pendingEncounter={state.pendingEncounter}
          onConsumePending={state.consumePending}
          onBackToMatches={() => state.navigate("matches")}
        />
      );
    case "team-challenge":
      return (
        <ResultsView
          api={publicApi.tc}
          pendingEncounter={null}
          onConsumePending={noop}
          onBackToMatches={noop}
        />
      );
    case "player-matches":
      return <PlayerMatchesView />;
    case "tournaments":
      return <TournamentsView />;
    case "agenda":
      return <AgendaView />;
    default:
      return <TeamsView />;
  }
}

function Layout(): JSX.Element {
  const { t } = useI18n();
  const { hash, navigate } = useHashRoute();
  const ratingsSubView = ratingsSubViewFromHash(hash);
  const matchesState = useResource(() => publicApi.matches(), []);
  const settingsState = useResource(() => publicApi.settings(), []);
  // Während des Ladens gelten die Server-Defaults (Training/Spieltermine aus),
  // damit ausgeblendete Tabs nicht kurz aufblitzen.
  const settings =
    settingsState.status === "ready" ? settingsState.data : { showTraining: false, showMatches: false };
  const requestedView = viewFromHash(hash);
  const view = isViewVisible(requestedView, settings) ? requestedView : DEFAULT_VIEW;
  const stand = matchesState.status === "ready" ? matchesState.data.updatedAt : "";
  const [pendingEncounter, setPendingEncounter] = useState<EncountRef | null>(null);

  useEffect(() => {
    document.title = t("app.documentTitle");
  }, [t]);

  const openEncounter = useCallback(
    (encountId: number, year: string, type: ResultType) => {
      setPendingEncounter({ encountId, year, type });
      navigate("results");
    },
    [navigate],
  );
  const consumePending = useCallback(() => setPendingEncounter(null), []);

  return (
    <div className="layout">
      <SiteHeader stand={stand} />
      <TabBar items={visibleNavItems(settings)} activeView={view} onSelect={(next) => navigate(next)} />
      <main className="container">
        <ActiveView
          view={view}
          ratingsSubView={ratingsSubView}
          matchesState={matchesState}
          pendingEncounter={pendingEncounter}
          navigate={navigate}
          openEncounter={openEncounter}
          consumePending={consumePending}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <Layout />
    </I18nProvider>
  );
}
