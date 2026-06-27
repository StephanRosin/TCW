/**
 * Wettbewerbs-Varianten der team-basierten Swisstennis-Resultate.
 *
 * Interclub (`ic`) und Team-Challenge (`hic`) liefern strukturell identische
 * Daten – Team-Challenge nutzt lediglich andere Schlüsselnamen (Root `I2cmh`,
 * `Hic`/`hic`-Präfixe statt `I2cm`/`Ic`/`ic`). `normalize` schreibt die
 * Team-Challenge-Schlüssel auf die Interclub-Form um, sodass alle bestehenden
 * Interclub-Mapper unverändert wiederverwendet werden können.
 */
export interface Competition {
  /** Pfad-Präfix der Swisstennis-Servlets (`ic` bzw. `hic`). */
  urlPrefix: string;
  /** Team-Challenge kennt keine Auf-/Abstiegsrunden – dann keine Bracket-Abfrage. */
  hasBrackets: boolean;
  /** Pfadsegment der öffentlichen mytennis.ch-Detailseite. */
  mytennisPath: string;
  /** Bringt die Rohdaten auf die Interclub-Schlüsselform. */
  normalize: (payload: unknown) => unknown;
}

/** Benennt Team-Challenge-Schlüssel (`I2cmh`, `Hic…`, `hic…`) auf die Interclub-Form um. */
function rekeyHicToIc(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map(rekeyHicToIc);
  }
  if (payload && typeof payload === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      const renamed =
        key === "I2cmh" ? "I2cm" : key.replace(/^Hic/, "Ic").replace(/^hic/, "ic");
      result[renamed] = rekeyHicToIc(value);
    }
    return result;
  }
  return payload;
}

export const INTERCLUB: Competition = {
  urlPrefix: "ic",
  hasBrackets: true,
  mytennisPath: "interclub",
  normalize: (payload) => payload,
};

export const TEAM_CHALLENGE: Competition = {
  urlPrefix: "hic",
  hasBrackets: false,
  mytennisPath: "team-challenge",
  normalize: rekeyHicToIc,
};
