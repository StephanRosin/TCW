/**
 * Bereinigung von Spielernamen.
 *
 * Statuszusätze wie "(neu)", "(07)", "(Neumitglied)" oder Suffixe wie
 * " - offen" / " - bestätigt" dürfen nicht Teil des gespeicherten Namens sein.
 * Sonderzeichen (Umlaute, Akzente, Apostrophe) müssen erhalten bleiben.
 */
const TRAILING_PARENTHESES = /\s*\([^)]*\)\s*$/;
const TRAILING_STATUS_SUFFIX = /\s*[-–]\s*(offen|bestätigt|bestaetigt|neu)\s*$/iu;

/** Entfernt Status-/Jahres-Zusätze am Namensende, behält den eigentlichen Namen. */
export function cleanPlayerName(rawName: string): string {
  let name = rawName.trim();
  let previous = "";
  while (name !== previous) {
    previous = name;
    name = name.replace(TRAILING_STATUS_SUFFIX, "").trim();
    name = name.replace(TRAILING_PARENTHESES, "").trim();
  }
  return name;
}
