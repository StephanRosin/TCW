/**
 * Hauptnavigation der Waidcup-Seite (drei Tabs) plus chromelose Kiosk-Route.
 */
export const MAIN_VIEWS = ["brackets", "matches", "live"] as const;

export type MainView = (typeof MAIN_VIEWS)[number];

export const DEFAULT_VIEW: MainView = "brackets";

/** Vollbild-Route für den Grossbildschirm am Turnier (ohne Header/Navigation). */
export const KIOSK_HASH = "kiosk";

export interface NavItem {
  view: MainView;
  labelKey: string;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { view: "brackets", labelKey: "nav.brackets" },
  { view: "matches", labelKey: "nav.matches" },
  { view: "live", labelKey: "nav.live" },
];

export function viewFromHash(hash: string): MainView {
  const key = hash.replace(/^#/, "").trim();
  return (MAIN_VIEWS as readonly string[]).includes(key) ? (key as MainView) : DEFAULT_VIEW;
}

export function isKioskHash(hash: string): boolean {
  return hash.replace(/^#/, "").trim() === KIOSK_HASH;
}
