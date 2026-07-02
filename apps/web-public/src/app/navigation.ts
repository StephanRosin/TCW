/**
 * Hauptnavigation der öffentlichen Seite.
 */
import type { SiteSettings } from "@tcw/shared";

export const MAIN_VIEWS = [
  "teams",
  "ticker",
  "training",
  "matches",
  "results",
  "team-challenge",
  "player-matches",
  "ratings",
  "tournaments",
  "agenda",
  "plaetze",
] as const;

export type MainView = (typeof MAIN_VIEWS)[number];

export const DEFAULT_VIEW: MainView = "teams";

export interface NavItem {
  view: MainView;
  labelKey: string;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { view: "teams", labelKey: "nav.teams" },
  { view: "ticker", labelKey: "nav.ticker" },
  { view: "training", labelKey: "nav.training" },
  { view: "matches", labelKey: "nav.matches" },
  { view: "results", labelKey: "nav.results" },
  { view: "team-challenge", labelKey: "nav.teamChallenge" },
  { view: "player-matches", labelKey: "nav.playerMatches" },
  { view: "ratings", labelKey: "nav.ratings" },
  { view: "tournaments", labelKey: "nav.tournaments" },
  { view: "agenda", labelKey: "nav.agenda" },
  { view: "plaetze", labelKey: "nav.plaetze" },
];

/** Ob eine Ansicht laut Einstellungen sichtbar ist (Training/Spieltermine schaltbar). */
export function isViewVisible(view: MainView, settings: SiteSettings): boolean {
  if (view === "training") return settings.showTraining;
  if (view === "matches") return settings.showMatches;
  return true;
}

/** Nav-Einträge ohne ausgeblendete Bereiche. */
export function visibleNavItems(settings: SiteSettings): NavItem[] {
  return NAV_ITEMS.filter((item) => isViewVisible(item.view, settings));
}

/** Direkte Hash-Aliase auf den Klassierungsbereich (Untertabs). */
const RATINGS_ALIASES: Record<string, MainView> = {
  changes: "ratings",
  compare: "ratings",
};

export function viewFromHash(hash: string): MainView {
  const key = hash.replace(/^#/, "").trim();
  if ((MAIN_VIEWS as readonly string[]).includes(key)) {
    return key as MainView;
  }
  return RATINGS_ALIASES[key] ?? DEFAULT_VIEW;
}

export type RatingsSubView = "changes" | "compare";

export function ratingsSubViewFromHash(hash: string): RatingsSubView {
  return hash.replace(/^#/, "").trim() === "compare" ? "compare" : "changes";
}
