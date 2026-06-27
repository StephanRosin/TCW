/**
 * Formatiert ein Datum ohne Uhrzeit als TT.MM.JJJJ. Bei unparsbaren Werten
 * wird der erste Teil vor einem Leerzeichen zurückgegeben.
 */
export function formatDateOnly(raw: string): string {
  const value = raw.trim();
  if (value === "") {
    return "";
  }
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return value.split(/\s+/)[0] ?? value;
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${parsed.getFullYear()}`;
}
