/**
 * Statische Vergleichstabelle Deutsche Leistungsklasse (LK 1–25) ↔
 * Swiss-Tennis-Klassierung (N1–R9) ↔ NTRP-Näherung.
 *
 * Der Farbverlauf folgt logisch dem Niveau: starkes Court-Grün oben,
 * über Sandtöne zu warmem Clay unten – ohne bedeutungslose Sprünge.
 */
export interface CompareRow {
  lk: string;
  swiss: string;
  width: number;
  ntrp: string;
}

export const COMPARE_ROWS: ReadonlyArray<CompareRow> = [
  { lk: "LK 1", swiss: "N1", width: 100, ntrp: "7.0" },
  { lk: "LK 2", swiss: "N1", width: 95, ntrp: "6.5" },
  { lk: "LK 3", swiss: "N2", width: 90, ntrp: "6.0" },
  { lk: "LK 4", swiss: "N3", width: 85, ntrp: "5.5" },
  { lk: "LK 5", swiss: "N4 / R1", width: 80, ntrp: "5.5" },
  { lk: "LK 6", swiss: "R1", width: 75, ntrp: "5.0" },
  { lk: "LK 7", swiss: "R2", width: 70, ntrp: "5.0" },
  { lk: "LK 8", swiss: "R2", width: 65, ntrp: "4.5" },
  { lk: "LK 9", swiss: "R3", width: 60, ntrp: "4.5" },
  { lk: "LK 10", swiss: "R3", width: 56, ntrp: "4.5" },
  { lk: "LK 11", swiss: "R4", width: 52, ntrp: "4.0" },
  { lk: "LK 12", swiss: "R4", width: 48, ntrp: "4.0" },
  { lk: "LK 13", swiss: "R5", width: 44, ntrp: "4.0" },
  { lk: "LK 14", swiss: "R5", width: 40, ntrp: "3.5" },
  { lk: "LK 15", swiss: "R5 / R6", width: 36, ntrp: "3.5" },
  { lk: "LK 16", swiss: "R6", width: 33, ntrp: "3.5" },
  { lk: "LK 17", swiss: "R6", width: 30, ntrp: "3.0" },
  { lk: "LK 18", swiss: "R7", width: 27, ntrp: "3.0" },
  { lk: "LK 19", swiss: "R7", width: 24, ntrp: "3.0" },
  { lk: "LK 20", swiss: "R7 / R8", width: 21, ntrp: "2.5" },
  { lk: "LK 21", swiss: "R8", width: 18, ntrp: "2.5" },
  { lk: "LK 22", swiss: "R8", width: 15, ntrp: "2.5" },
  { lk: "LK 23", swiss: "R8 / R9", width: 12, ntrp: "2.5" },
  { lk: "LK 24", swiss: "R9", width: 9, ntrp: "2.0" },
  { lk: "LK 25", swiss: "R9", width: 6, ntrp: "2.0" },
];

export const COMPARE_LEVELS = [
  "N1",
  "N2",
  "N3",
  "N4",
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
] as const;

/** Farbe je Niveau: Grünton (stark) → Clay (schwächer), gleichmäßig interpoliert. */
export function levelColor(level: string): string {
  const index = COMPARE_LEVELS.indexOf(level as (typeof COMPARE_LEVELS)[number]);
  if (index < 0) {
    return "var(--ink-400)";
  }
  const ratio = index / (COMPARE_LEVELS.length - 1);
  const hue = Math.round(150 - ratio * 132); // 150° Grün → 18° Clay
  const saturation = 55;
  const lightness = Math.round(42 + ratio * 8);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/** Erstes Niveau eines Vergleichseintrags (z. B. "N4 / R1" → "N4"). */
export function primaryLevel(swiss: string): string {
  return swiss.split("/")[0]?.trim() ?? swiss;
}
