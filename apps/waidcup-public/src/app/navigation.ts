/**
 * Hauptnavigation der Waidcup-Seite (Tabs) plus chromelose Kiosk-Route.
 * „Standort" ist zugleich die Willkommensseite und damit der Default.
 */
export const MAIN_VIEWS = ["location", "infos", "helpers", "brackets", "matches", "orderofplay", "live", "webcam", "tour"] as const;

export type MainView = (typeof MAIN_VIEWS)[number];

export const DEFAULT_VIEW: MainView = "location";

/** Vollbild-Route für den Grossbildschirm am Turnier (ohne Header/Navigation). */
export const KIOSK_HASH = "kiosk";

/** Chromelose, login-geschützte Adminseite. */
export const ADMIN_HASH = "admin";

export function isAdminHash(hash: string): boolean {
  return hash.replace(/^#/, "").trim() === ADMIN_HASH;
}

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
  return hash.replace(/^#/, "").trim().split("/")[0] === KIOSK_HASH;
}

/** Was der Kiosk zeigen soll: Live-Board oder ein Order-of-Play-Tag. */
export type KioskTarget = { kind: "live" } | { kind: "orderofplay"; day: "today" | "tomorrow" };

/** Parst die Kiosk-Route: `kiosk` → Live, `kiosk/orderofplay/(today|tomorrow)`
 *  → Tagesspielplan. Kein Kiosk-Hash → null. */
export function parseKioskTarget(hash: string): KioskTarget | null {
  const segs = hash.replace(/^#/, "").trim().split("/").filter((s) => s !== "");
  if (segs[0] !== KIOSK_HASH) return null;
  if (segs[1] === "orderofplay") {
    return { kind: "orderofplay", day: segs[2] === "tomorrow" ? "tomorrow" : "today" };
  }
  return { kind: "live" };
}

/** Kiosk-Link für einen Order-of-Play-Tag (neuer Tab, Vollbild). */
export function orderOfPlayKioskHash(day: "today" | "tomorrow"): string {
  return `#${KIOSK_HASH}/orderofplay/${day}`;
}
