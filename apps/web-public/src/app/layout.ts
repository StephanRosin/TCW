/**
 * Layout-Wahl der öffentlichen Seite: klassisches Layout (Header + Tableiste,
 * Standard) oder das neue Studio-Layout mit Seitennavigation. Persistiert wie
 * die Themenwahl in localStorage.
 */
export type LayoutMode = "classic" | "studio";

export interface LayoutOption {
  id: LayoutMode;
  labelKey: string;
}

export const LAYOUTS: ReadonlyArray<LayoutOption> = [
  { id: "classic", labelKey: "layout.classic" },
  { id: "studio", labelKey: "layout.studio" },
];

const STORAGE_KEY = "tcw-layout";
const DEFAULT_LAYOUT: LayoutMode = "classic";

export function getStoredLayout(): LayoutMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "classic" || value === "studio") return value;
  } catch {
    /* localStorage nicht verfügbar */
  }
  return DEFAULT_LAYOUT;
}

export function storeLayout(mode: LayoutMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignorieren */
  }
}
