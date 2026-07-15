/**
 * Helfer.innen-Einsatzplan des Waidcups als strukturierte, typisierte Daten
 * (Quelle: das offizielle PDF, das als Download bereitsteht). Bewusst als
 * Code-Datei gepflegt statt Server-API: der Plan ist ein statisches Dokument,
 * das von Hand aktualisiert und mitdeployt wird.
 *
 * Aufbau: 10 Tage (Spalten) × feste Zeitslots (Zeilen). Jede Zelle listet die
 * Rollen mit Namen; leere Namen bedeuten „noch offen". Die Task-Beschreibungen
 * stehen separat als Rollen-Legende.
 *
 * Alle anzeigbaren Texte sind i18n-Keys (Rollen, Wochentage, Tages-Labels,
 * Marker, Tasks) und werden erst in der View übersetzt – nur Eigennamen bleiben
 * als Klartext in den Daten. So ist der Plan komplett mehrsprachig.
 */

/** Rollen-Keys → Label über `helpers.role.<key>`. */
export type RoleKey =
  | "spielleitung"
  | "assistenz"
  | "bar"
  | "barPommes"
  | "barBereit"
  | "pasta"
  | "grill"
  | "springer"
  | "vorbereitung"
  | "aufraeumen"
  | "aufraeumenAbschliessen"
  | "kasse";

/** Hauptrollen für die Legende/Task-Beschreibungen. */
export const LEGEND_ROLES: readonly RoleKey[] = [
  "spielleitung",
  "assistenz",
  "barPommes",
  "pasta",
  "grill",
  "springer",
];

/**
 * Namens-Korrekturen: im PDF stehen (auch in der finalen Version) manche
 * Kürzel/falschen Namen. Hier zentral gemappt – beim nächsten PDF einfach mit
 * den Kürzeln transkribieren, die Korrektur greift automatisch.
 */
const NAME_FIX: Record<string, string> = {
  Ma: "Martina",
  Willi: "Stephan W.",
  Kuschi: "Stefan K.",
  Dani: "Daniela",
};

/** Wendet die Namens-Korrekturen auf eine (ggf. mehrfache) Namensangabe an. */
function fixNames(names: string): string {
  return names
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((name) => NAME_FIX[name] ?? name)
    .join("; ");
}

/** Eine Rollen-Zeile in einer Zelle: Rollen-Key + Namen (roh). */
export interface PlanLine {
  role: RoleKey;
  names: string;
}

/** Marker einer Zelle: i18n-Key plus bis zu zwei Platzhalter (z. B. Zeiten). */
export interface PlanNote {
  key: string;
  a?: string;
  b?: string;
}

/** Tages-Label als Key plus optionale Nummer (z. B. „{n}. Spieltag"). */
export interface DayLabel {
  key: string;
  n?: string;
}

/** Eine Raster-Zelle: optionaler Marker plus Rollen-Zeilen. */
export interface PlanCell {
  note?: PlanNote;
  lines: PlanLine[];
}

/** Eine Tages-Spalte (Schlüssel der Zellen = Zeitslot aus SLOTS). */
export interface PlanDay {
  key: string;
  weekdayKey: string;
  date: string;
  label: DayLabel;
  cells: Partial<Record<string, PlanCell>>;
}

/** Zeitslots (Zeilen) in fester Reihenfolge, en-dash als Trenner. */
export const SLOTS: readonly string[] = [
  "08:30–09:30",
  "09:30–10:30",
  "10:30–11:30",
  "11:30–12:30",
  "12:30–13:30",
  "13:30–14:30",
  "14:30–15:30",
  "15:30–16:30",
  "16:30–17:30",
  "17:30–18:30",
  "18:30–19:30",
  "19:30–20:30",
  "20:30–22:00",
];

const SL = "Stephan R."; // Spielleitung ist durchgehend Stephan R.

/** Rollen-Zeile mit Namens-Korrektur. */
function line(role: RoleKey, names = ""): PlanLine {
  return { role, names: fixNames(names) };
}
/** Standard-Kopf einer Spielbetriebs-Zelle: Spielleitung (Stephan R.) + Assistenz. */
function head(assist = ""): PlanLine[] {
  return [line("spielleitung", SL), line("assistenz", assist)];
}
function cell(note: PlanNote | undefined, lines: PlanLine[]): PlanCell {
  return note ? { note, lines } : { lines };
}

const D = (key: string, n?: string): DayLabel => (n ? { key, n } : { key });
const NOTE = (key: string, a?: string, b?: string): PlanNote => ({ key, a, b });

export const DAYS: readonly PlanDay[] = [
  {
    key: "fr-17",
    weekdayKey: "helpers.weekday.fri",
    date: "17.07.2026",
    label: D("helpers.day.prep"),
    cells: {
      "17:30–18:30": cell(NOTE("helpers.note.helperInfo", "18:00"), []),
      "18:30–19:30": cell(undefined, [line("vorbereitung", "Stephan R.; Markus; Anne; Ma; Tim; Florine; Allison")]),
      "19:30–20:30": cell(undefined, [line("vorbereitung", "Stephan R.; Markus; Anne; Ma; Tim; Florine; Allison")]),
    },
  },
  {
    key: "sa-18",
    weekdayKey: "helpers.weekday.sat",
    date: "18.07.2026",
    label: D("helpers.day.matchday", "1"),
    cells: {
      "08:30–09:30": cell(NOTE("helpers.note.playShift", "9:00", "8:30"), [...head("Anne"), line("bar", "Victoria H.")]),
      "09:30–10:30": cell(undefined, [...head("Anne"), line("bar", "Victoria H.")]),
      "10:30–11:30": cell(undefined, [...head("Anne"), line("barPommes", "Alex"), line("pasta", "Victoria H."), line("grill", "Marvin")]),
      "11:30–12:30": cell(undefined, [...head("Anne"), line("barPommes", "Alex"), line("pasta", "Victoria H."), line("grill", "Marvin")]),
      "12:30–13:30": cell(undefined, [...head("Anne"), line("barPommes", "Alex"), line("pasta", "Jenny"), line("grill", "Marvin")]),
      "13:30–14:30": cell(undefined, [...head("Anne"), line("barPommes", "Alex"), line("pasta", "Jenny"), line("grill", "Marvin")]),
      "14:30–15:30": cell(undefined, [...head("Anne; Markus"), line("barPommes", "Sofia"), line("pasta", "Jenny"), line("grill", "Manuel")]),
      "15:30–16:30": cell(undefined, [...head("Markus"), line("barPommes", "Sofia"), line("pasta", "Jenny"), line("grill", "Manuel")]),
      "16:30–17:30": cell(undefined, [...head("Markus"), line("barPommes", "Sofia"), line("pasta", "Benjamin"), line("grill", "Manuel")]),
      "17:30–18:30": cell(undefined, [...head("Markus"), line("barPommes", "Sofia"), line("pasta", "Benjamin"), line("grill", "Manuel")]),
      "18:30–19:30": cell(undefined, [...head("Markus"), line("barPommes", "Benjamin"), line("pasta", ""), line("grill", "")]),
      "19:30–20:30": cell(undefined, [...head("Markus"), line("barPommes", "Benjamin"), line("pasta", ""), line("grill", "")]),
      "20:30–22:00": cell(undefined, [...head("Markus"), line("barPommes", ""), line("aufraeumenAbschliessen", ""), line("kasse", "")]),
    },
  },
  {
    key: "so-19",
    weekdayKey: "helpers.weekday.sun",
    date: "19.07.2026",
    label: D("helpers.day.matchday", "2"),
    cells: {
      "08:30–09:30": cell(NOTE("helpers.note.playShift", "9:00", "8:30"), [...head("Anne"), line("bar", "Fränzi")]),
      "09:30–10:30": cell(undefined, [...head("Anne"), line("bar", "Fränzi")]),
      "10:30–11:30": cell(undefined, [...head("Anne"), line("barPommes", "Victoria K."), line("pasta", "Fränzi"), line("grill", "")]),
      "11:30–12:30": cell(undefined, [...head("Anne"), line("barPommes", "Victoria K."), line("pasta", "Fränzi"), line("grill", "Etienne")]),
      "12:30–13:30": cell(undefined, [...head("Anne"), line("barPommes", "Willi"), line("pasta", "Victoria K."), line("grill", "Etienne")]),
      "13:30–14:30": cell(undefined, [...head("Anne"), line("barPommes", "Willi"), line("pasta", "Victoria K."), line("grill", "Etienne")]),
      "14:30–15:30": cell(undefined, [...head("Anne; Markus"), line("barPommes", "Sofia"), line("pasta", "Willi"), line("grill", "Etienne")]),
      "15:30–16:30": cell(undefined, [...head("Markus"), line("barPommes", "Sofia"), line("pasta", "Willi"), line("grill", "Flo")]),
      "16:30–17:30": cell(undefined, [...head("Markus"), line("barPommes", "Sofia"), line("pasta", "Johanna"), line("grill", "Flo")]),
      "17:30–18:30": cell(undefined, [...head("Markus"), line("barPommes", "Sofia"), line("pasta", "Johanna"), line("grill", "Flo")]),
      "18:30–19:30": cell(undefined, [...head("Markus"), line("barPommes", "Johanna"), line("pasta", ""), line("grill", "Flo")]),
      "19:30–20:30": cell(undefined, [...head("Markus"), line("barPommes", "Johanna"), line("pasta", ""), line("grill", "")]),
      "20:30–22:00": cell(undefined, [...head("Markus"), line("barPommes", ""), line("aufraeumenAbschliessen", ""), line("kasse", "")]),
    },
  },
  {
    key: "mo-20",
    weekdayKey: "helpers.weekday.mon",
    date: "20.07.2026",
    label: D("helpers.day.matchday", "3"),
    cells: {
      "16:30–17:30": cell(NOTE("helpers.note.playReception", "18:00", "17:00"), [line("spielleitung", SL), line("barBereit", "Ma")]),
      "17:30–18:30": cell(undefined, [...head("Ma"), line("barPommes", "Elio"), line("grill", "Martin"), line("springer", "Tom")]),
      "18:30–19:30": cell(undefined, [...head("Ma"), line("barPommes", "Elio"), line("grill", "Martin"), line("springer", "Tom")]),
      "19:30–20:30": cell(undefined, [...head("Ma"), line("barPommes", "Martin"), line("grill", "Elio"), line("springer", "Tom")]),
      "20:30–22:00": cell(undefined, [...head("Ma"), line("barPommes", "Martin"), line("grill", "Elio"), line("springer", "Tom")]),
    },
  },
  {
    key: "di-21",
    weekdayKey: "helpers.weekday.tue",
    date: "21.07.2026",
    label: D("helpers.day.matchday", "4"),
    cells: {
      "16:30–17:30": cell(NOTE("helpers.note.playReception", "18:00", "17:00"), [line("spielleitung", SL), line("barBereit", "Anne")]),
      "17:30–18:30": cell(undefined, [...head("Dani"), line("barPommes", "Tomke"), line("grill", "Sophie"), line("springer", "Constance")]),
      "18:30–19:30": cell(undefined, [...head("Dani"), line("barPommes", "Tomke"), line("grill", "Sophie"), line("springer", "Constance")]),
      "19:30–20:30": cell(undefined, [...head("Dani"), line("barPommes", "Sophie"), line("grill", "Tomke"), line("springer", "Constance")]),
      "20:30–22:00": cell(undefined, [...head("Dani"), line("barPommes", "Sophie"), line("grill", "Tomke"), line("springer", "Constance")]),
    },
  },
  {
    key: "mi-22",
    weekdayKey: "helpers.weekday.wed",
    date: "22.07.2026",
    label: D("helpers.day.matchday", "5"),
    cells: {
      "16:30–17:30": cell(NOTE("helpers.note.playReception", "18:00", "17:00"), [line("spielleitung", SL), line("barBereit", "Dani")]),
      "17:30–18:30": cell(undefined, [...head("Dani"), line("barPommes", "Isabel"), line("grill", "Nadia"), line("springer", "Domas")]),
      "18:30–19:30": cell(undefined, [...head("Dani"), line("barPommes", "Isabel"), line("grill", "Nadia"), line("springer", "Domas")]),
      "19:30–20:30": cell(undefined, [...head("Dani"), line("barPommes", "Nadia"), line("grill", "Isabel"), line("springer", "Domas")]),
      "20:30–22:00": cell(undefined, [...head("Dani"), line("barPommes", "Nadia"), line("grill", "Isabel"), line("springer", "Domas")]),
    },
  },
  {
    key: "do-23",
    weekdayKey: "helpers.weekday.thu",
    date: "23.07.2026",
    label: D("helpers.day.matchday", "6"),
    cells: {
      "16:30–17:30": cell(NOTE("helpers.note.playReception", "18:00", "17:00"), [line("spielleitung", SL), line("barBereit", "Dani")]),
      "17:30–18:30": cell(undefined, [...head("Anne"), line("barPommes", "Josephine"), line("grill", "Wouter"), line("springer", "Andrina")]),
      "18:30–19:30": cell(undefined, [...head("Anne"), line("barPommes", "Josephine"), line("grill", "Wouter"), line("springer", "Andrina")]),
      "19:30–20:30": cell(undefined, [...head("Anne"), line("barPommes", "Wouter"), line("grill", "Josephine"), line("springer", "Andrina")]),
      "20:30–22:00": cell(undefined, [...head("Anne"), line("barPommes", "Wouter"), line("grill", "Josephine"), line("springer", "Andrina")]),
    },
  },
  {
    key: "fr-24",
    weekdayKey: "helpers.weekday.fri",
    date: "24.07.2026",
    label: D("helpers.day.matchdayParty", "7"),
    cells: {
      "16:30–17:30": cell(NOTE("helpers.note.playReception", "18:00", "17:00"), [line("spielleitung", SL), line("barBereit", "Ma")]),
      "17:30–18:30": cell(undefined, [...head("Ma"), line("barPommes", "Claudia"), line("grill", "Decks"), line("springer", "Dani")]),
      "18:30–19:30": cell(undefined, [...head("Ma"), line("barPommes", "Claudia"), line("grill", "Decks"), line("springer", "Dani")]),
      "19:30–20:30": cell(undefined, [...head("Ma"), line("barPommes", "Claudia"), line("grill", "Decks"), line("springer", "Dani")]),
      "20:30–22:00": cell(undefined, [...head("Ma"), line("barPommes", "Claudia"), line("grill", "Decks"), line("springer", "Dani")]),
    },
  },
  {
    key: "sa-25",
    weekdayKey: "helpers.weekday.sat",
    date: "25.07.2026",
    label: D("helpers.day.matchday", "8"),
    cells: {
      "09:30–10:30": cell(NOTE("helpers.note.playShift", "10:00", "9:30"), [...head("Anne"), line("bar", "Quinten"), line("springer", "Jochen")]),
      "10:30–11:30": cell(undefined, [...head("Anne"), line("bar", "Quinten"), line("springer", "Jochen")]),
      "11:30–12:30": cell(undefined, [...head("Anne"), line("barPommes", "Quinten"), line("grill", "Kuschi"), line("springer", "Jochen")]),
      "12:30–13:30": cell(undefined, [...head("Anne"), line("barPommes", "Quinten"), line("grill", "Kuschi"), line("springer", "Ma")]),
      "13:30–14:30": cell(undefined, [...head("Anne"), line("barPommes", "Kuschi"), line("grill", "Quinten"), line("springer", "Ma")]),
      "14:30–15:30": cell(undefined, [...head("Anne"), line("barPommes", "Kuschi"), line("grill", "Jose"), line("springer", "Ma")]),
      "15:30–16:30": cell(undefined, [...head("Anne"), line("barPommes", ""), line("grill", "Jose"), line("springer", "Ma")]),
      "16:30–17:30": cell(NOTE("helpers.note.awards", "17:00"), [...head("Anne"), line("barPommes", ""), line("grill", "Jose"), line("springer", "Ma")]),
      "17:30–18:30": cell(NOTE("helpers.note.cleanup", "18:00"), [line("aufraeumen", "Jose")]),
      "18:30–19:30": cell(undefined, [line("aufraeumen", "")]),
      "19:30–20:30": cell(undefined, [line("aufraeumen", "")]),
    },
  },
  {
    key: "so-26",
    weekdayKey: "helpers.weekday.sun",
    date: "26.07.2026",
    label: D("helpers.day.reserve"),
    cells: {},
  },
];

/** Metadaten für Anzeige und Download. */
export const PLAN_META = {
  /** Stand-Kennzeichnung; bei jedem neuen PDF anpassen. */
  version: "V05",
  provisional: false,
  /** Datei im public/-Ordner (Original-PDF zum Download). */
  pdfFile: "einsatzplan-waidcup-2026.pdf",
} as const;
