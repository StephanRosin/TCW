/**
 * Hauptnavigation der öffentlichen Seite.
 */
export const MAIN_VIEWS = [
  "teams",
  "training",
  "matches",
  "results",
  "ratings",
  "tournaments",
  "agenda",
] as const;

export type MainView = (typeof MAIN_VIEWS)[number];

export const DEFAULT_VIEW: MainView = "teams";

export interface NavItem {
  view: MainView;
  labelKey: string;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { view: "teams", labelKey: "nav.teams" },
  { view: "training", labelKey: "nav.training" },
  { view: "matches", labelKey: "nav.matches" },
  { view: "results", labelKey: "nav.results" },
  { view: "ratings", labelKey: "nav.ratings" },
  { view: "tournaments", labelKey: "nav.tournaments" },
  { view: "agenda", labelKey: "nav.agenda" },
];

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
