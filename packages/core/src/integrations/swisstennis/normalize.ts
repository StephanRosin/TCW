/**
 * Normalisierung von Swisstennis-Rohdaten.
 *
 * Swisstennis liefert bei genau einem Element ein Objekt statt eines Arrays.
 * `asArray` glättet das. Weitere Helfer kapseln tief verschachtelte Zugriffe.
 */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

/** Wandelt einen Wert in eine endliche Zahl oder den Fallback. */
export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Säubert Swisstennis-Texte (geschützte Leerzeichen, Mehrfach-Whitespace). */
export function cleanText(value: unknown): string {
  let text = "";
  if (typeof value === "string") text = value;
  else if (typeof value === "number") text = String(value);
  return text
    .replaceAll(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Liefert den Clubnamen aus einem `icTeam`-Knoten. */
export function clubNameFromIcTeam(node: unknown): string {
  const team = node as { IcTeam?: { mitglied?: { Mitglied?: { icName?: string } } } } | undefined;
  return cleanText(team?.IcTeam?.mitglied?.Mitglied?.icName ?? "–");
}
