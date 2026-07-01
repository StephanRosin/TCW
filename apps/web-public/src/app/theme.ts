/**
 * Farbthemen der öffentlichen Seite. Umgesetzt über `data-theme` am
 * <html>-Element; die eigentlichen Farben liegen als CSS-Variablen in app.css.
 * Das Layout bleibt themenübergreifend identisch.
 */
export interface ThemeOption {
  id: string;
  labelKey: string;
  /** Repräsentative Farbe für den Auswahl-Punkt. */
  dot: string;
}

export const THEMES: ReadonlyArray<ThemeOption> = [
  { id: "night", labelKey: "theme.night", dot: "#c8f135" },
  { id: "club", labelKey: "theme.club", dot: "#25348b" },
  { id: "nacht", labelKey: "theme.nacht", dot: "#10142a" },
  { id: "sand", labelKey: "theme.sand", dot: "#b35d34" },
  { id: "wald", labelKey: "theme.wald", dot: "#2a7d3a" },
  { id: "schiefer", labelKey: "theme.schiefer", dot: "#3a4350" },
];

const STORAGE_KEY = "tcw-theme";
// Redesign-Prototyp: „Night Court" als Standard, damit der neue Look direkt sichtbar ist.
const DEFAULT_THEME = "night";

export function getStoredTheme(): string {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && THEMES.some((theme) => theme.id === value)) return value;
  } catch {
    /* localStorage nicht verfügbar */
  }
  return DEFAULT_THEME;
}

export function applyTheme(id: string): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignorieren */
  }
}

// Gespeichertes Theme früh anwenden (vor dem ersten Render), um Flackern zu vermeiden.
if (typeof document !== "undefined") {
  document.documentElement.dataset.theme = getStoredTheme();
}
