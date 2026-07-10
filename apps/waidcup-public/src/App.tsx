/**
 * Wurzelkomponente der Waidcup-Seite: Mehrsprachigkeit, Hash-Routing und das
 * Classic-Layout (Header, Tabs, Inhalt, Footer). Die Kiosk-Route rendert
 * chromelos nur das Live-Board.
 */
import { useEffect, type JSX } from "react";
import { I18nProvider, useHashRoute, useI18n } from "@tcw/tournament-ui";
import { isKioskHash, viewFromHash, type MainView } from "./app/navigation.js";
import { SiteFooter, SiteHeader, TabBar } from "./components/SiteChrome.js";
import { BracketsView } from "./features/brackets/BracketsView.js";
import { MatchesView } from "./features/matches/MatchesView.js";
import { LiveView } from "./features/live/LiveView.js";
import { LocationView } from "./features/location/LocationView.js";
import { InfosView } from "./features/infos/InfosView.js";
import { OrderOfPlayView } from "./features/orderofplay/OrderOfPlayView.js";
import { WebcamView } from "./features/webcam/WebcamView.js";
import { TourView } from "./features/tour/TourView.js";
import { KioskView } from "./features/kiosk/KioskView.js";

function ActiveView({ view }: Readonly<{ view: MainView }>): JSX.Element {
  switch (view) {
    case "infos":
      return <InfosView />;
    case "brackets":
      return <BracketsView />;
    case "matches":
      return <MatchesView />;
    case "orderofplay":
      return <OrderOfPlayView />;
    case "live":
      return <LiveView />;
    case "webcam":
      return <WebcamView />;
    case "tour":
      return <TourView />;
    default:
      return <LocationView />;
  }
}

function Layout(): JSX.Element {
  const { t } = useI18n();
  const { hash, navigate } = useHashRoute();

  useEffect(() => {
    document.title = t("app.documentTitle");
  }, [t]);

  if (isKioskHash(hash)) {
    return <KioskView />;
  }

  const view = viewFromHash(hash);
  return (
    <div className="layout">
      <SiteHeader />
      <TabBar activeView={view} onSelect={(next) => navigate(next)} />
      <main className="container">
        <ActiveView view={view} />
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
