/**
 * Einheitliche Extraktion einer Fehlermeldung aus unbekannten Fehlerwerten.
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
