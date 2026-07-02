/**
 * Zentrale, fachliche Konstanten des TCW Spielbetriebs.
 *
 * Diese Werte sind die einzige autoritative Quelle für Ligen, Kategorien,
 * Sprachen, Disziplinen und die eigene Club-Identität. Sie werden sowohl im
 * Backend (Normalisierung, Sortierung) als auch im Frontend (Anzeige) genutzt,
 * damit keine magischen Strings im Code verstreut werden.
 */

/** Anzeigename des eigenen Clubs in Swisstennis-Daten. Immer hervorgehoben. */
export const OWN_CLUB_NAME = "Waidberg ZH";

/** Numerische Swisstennis-Club-Nummer des TC Waidberg (Parameter `ClubName`). */
export const OWN_CLUB_ID = 1298;

/** Offizielle Schreibweise des Verbands. Nie "Swiss Tennis". */
export const SWISSTENNIS_LABEL = "Swisstennis";

export const SUPPORTED_LANGUAGES = ["de", "en", "fr", "it"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "de";
export const LANGUAGE_STORAGE_KEY = "tcw_language";

export const GENDERS = ["Damen", "Herren"] as const;
export type Gender = (typeof GENDERS)[number];

export const CAPTAIN_STATUS = {
  none: 0,
  captain: 1,
  viceCaptain: 2,
} as const;
export type CaptainStatus = (typeof CAPTAIN_STATUS)[keyof typeof CAPTAIN_STATUS];

/** Trainingswochentage in Wochenordnung (deutsche Originalbezeichnung als DB-Wert). */
export const TRAINING_DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
] as const;
export type TrainingDay = (typeof TRAINING_DAYS)[number];

/** Im Public-Trainingsplan sichtbare Plätze (5 und 6 sind Tennisschule). */
export const PUBLIC_TRAINING_COURTS = [1, 2, 3, 4] as const;
export const TRAINING_WINDOW_START = "18:00";
export const TRAINING_WINDOW_END = "22:00";

/** 30-Minuten-Raster des Admin-Trainingsgrids von 18:00 bis 22:00. */
export const TRAINING_GRID_SLOTS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "18:00", to: "18:30" },
  { from: "18:30", to: "19:00" },
  { from: "19:00", to: "19:30" },
  { from: "19:30", to: "20:00" },
  { from: "20:00", to: "20:30" },
  { from: "20:30", to: "21:00" },
  { from: "21:00", to: "21:30" },
  { from: "21:30", to: "22:00" },
];

/** In der Ergebnis-Ansicht auswählbare Jahre (aktuell + Vorjahre). */
export const RESULTS_YEARS = ["2026", "2025", "2024", "2023", "2022", "2021"] as const;

/** Turnier-Disziplinen in fachlicher Sortierreihenfolge. */
export const DISCIPLINE_ORDER = ["WS", "MS", "WD", "MD", "DM"] as const;
export type Discipline = (typeof DISCIPLINE_ORDER)[number];

/** Disziplinen je Geschlechtszeile in der Turnier-Kategorienauswahl. */
export const WOMEN_DISCIPLINES: ReadonlyArray<Discipline> = ["WS", "WD", "DM"];
export const MEN_DISCIPLINES: ReadonlyArray<Discipline> = ["MS", "MD", "DM"];

export type ResultType = "encount" | "tableau";
export type PlayoffType = "promotion" | "relegation" | "";
export type TournamentMatchStatus = "open" | "played";

/** Erlaubte Ziel-Hosts für externe Links aus Nutzdaten. */
export const ALLOWED_EXTERNAL_HOSTS = ["mytennis.ch", "www.mytennis.ch"] as const;
