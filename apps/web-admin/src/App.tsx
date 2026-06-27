/**
 * Adminbereich des TCW Spielbetriebs: interne Datenpflege mit Tab-Navigation.
 */
import { useState, type JSX } from "react";
import { TeamsAdmin } from "./features/TeamsAdmin.js";
import { PlayersAdmin } from "./features/PlayersAdmin.js";
import { TrainingAdmin } from "./features/TrainingAdmin.js";
import { RankingAdmin } from "./features/RankingAdmin.js";
import { TournamentsAdmin } from "./features/TournamentsAdmin.js";
import { ActionsAdmin } from "./features/ActionsAdmin.js";
import { SettingsAdmin } from "./features/SettingsAdmin.js";

const TABS = [
  { key: "teams", label: "Teams", render: () => <TeamsAdmin /> },
  { key: "players", label: "Spieler", render: () => <PlayersAdmin /> },
  { key: "training", label: "Trainingsraster", render: () => <TrainingAdmin /> },
  { key: "ranking", label: "Klassierungen", render: () => <RankingAdmin /> },
  { key: "tournaments", label: "Turniere", render: () => <TournamentsAdmin /> },
  { key: "anzeige", label: "Anzeige", render: () => <SettingsAdmin /> },
  { key: "actions", label: "Aktionen", render: () => <ActionsAdmin /> },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function App(): JSX.Element {
  const [active, setActive] = useState<TabKey>("teams");
  const activeTab = TABS.find((tab) => tab.key === active) ?? TABS[0];

  return (
    <div>
      <header className="admin-header">
        <h1>TCW Spielbetrieb · Adminbereich</h1>
        <span>Interne Datenpflege (LAN)</span>
      </header>
      <nav className="admin-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === active}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className="admin-main">{activeTab.render()}</main>
    </div>
  );
}
