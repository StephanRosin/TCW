/**
 * Hauptnavigation der Waidcup-Seite (Tabs) plus chromelose Kiosk-Route.
 * „Standort" ist zugleich die Willkommensseite und damit der Default.
 */
export const MAIN_VIEWS = ["location", "infos", "helpers", "brackets", "matches", "orderofplay", "live", "webcam", "tour"] as const;

export type MainView = (typeof MAIN_VIEWS)[number];

export const DEFAULT_VIEW: MainView = "location";

/** Vollbild-Route für den Grossbildschirm am Turnier (ohne Header/Navigation). */
export const KIOSK_HASH = "kiosk";

export interface NavItem {
  view: MainView;
  labelKey: string;
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { view: "location", labelKey: "nav.location" },
  { view: "infos", labelKey: "nav.infos" },
  { view: "helpers", labelKey: "nav.helpers" },
  { view: "brackets", labelKey: "nav.brackets" },
  { view: "matches", labelKey: "nav.matches" },
  { view: "orderofplay", labelKey: "nav.orderOfPlay" },
  { view: "live", labelKey: "nav.live" },
  { view: "webcam", labelKey: "nav.webcam" },
  { view: "tour", labelKey: "nav.tour" },
];

export function viewFromHash(hash: string): MainView {
  const key = hash.replace(/^#/, "").trim();
  return (MAIN_VIEWS as readonly string[]).includes(key) ? (key as MainView) : DEFAULT_VIEW;
}

export function isKioskHash(hash: string): boolean {
  return hash.replace(/^#/, "").trim() === KIOSK_HASH;
}
