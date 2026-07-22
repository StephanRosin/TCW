/**
 * Bereinigung von Spielernamen.
 *
 * Statuszusätze wie "(neu)", "(07)", "(Neumitglied)" oder Suffixe wie
 * " - offen" / " - bestätigt" dürfen nicht Teil des gespeicherten Namens sein.
 * Sonderzeichen (Umlaute, Akzente, Apostrophe) müssen erhalten bleiben.
 */
// `[^()]` (statt `[^)]`) schließt auch die öffnende Klammer aus. Das verhindert
// quadratisches Backtracking (polynomiales ReDoS) bei Eingaben mit vielen „(",
// ohne das Verhalten für echte Namens-Suffixe wie „(R4)"/„(neu)" zu ändern.
const TRAILING_PARENTHESES = /\([^()]*\)$/;
const TRAILING_STATUS_SUFFIX = /[-–]\s*(offen|bestätigt|bestaetigt|neu)$/iu;
// Führende Setzposition im Tableau-Baum, z. B. „(1) Peloso Fabio". Rein
// numerisch → kann kein echter Namensbestandteil sein; für Key/Anzeige raus.
const LEADING_SEED = /^\(\d+\)\s*/;

/** Entfernt Status-/Jahres-/Setzpositions-Zusätze, behält den eigentlichen Namen. */
export function cleanPlayerName(rawName: string): string {
  let name = rawName.trim();
  let previous = "";
  while (name !== previous) {
    previous = name;
    name = name.replace(TRAILING_STATUS_SUFFIX, "").trim();
    name = name.replace(TRAILING_PARENTHESES, "").trim();
    name = name.replace(LEADING_SEED, "").trim();
  }
  return name;
}

/**
 * Reihenfolge-unabhängiger Vergleichsschlüssel eines Spielernamens für das
 * Matching zwischen Quellen, die mal "Vorname Nachname" (Vereinsdaten) und mal
 * "Nachname Vorname" (Swisstennis-Begegnungen) liefern. Entfernt Klassierung
 * und Diakritika, sortiert die Namensteile alphabetisch.
 *
 * Beispiel: "Rosin Stephan (R4)" und "Stephan Rosin" → beide "rosin stephan".
 */
export function playerNameKey(rawName: string): string {
  const tokens = cleanPlayerName(rawName)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token !== "");
  return [...tokens].sort((a, b) => a.localeCompare(b)).join(" ");
}

/**
 * Stabiler Personen-Schlüssel für das Waidcup-Admin (Bezahlt- & Check-In-
 * Tracking) und die Anwesenheits-Anzeige im Order of Play. Bewusst identisch
 * über alle drei Verwendungen, damit dieselbe Person überall zusammenfällt.
 */
export function waidcupPersonKey(rawName: string): string {
  return `name:${playerNameKey(rawName)}`;
}
