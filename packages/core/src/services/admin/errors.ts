/**
 * Fehlertypen der Admin-Dienste. `ValidationError` führt im HTTP-Layer zu 400,
 * `ConflictError` zu 409 (z. B. Eindeutigkeitsverletzung).
 */
export class ValidationError extends Error {
  override readonly name = "ValidationError";
}

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

/**
 * Führt eine schreibende DB-Operation aus. Datenbankfehler werden serverseitig
 * geloggt und als generischer `ConflictError` weitergegeben, damit keine
 * internen Constraint-/Spaltennamen an Clients gelangen.
 */
export function runDatabaseWrite<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    console.error("Datenbank-Schreibfehler:", error);
    throw new ConflictError("Speichern nicht möglich – Datenkonflikt in der Datenbank.");
  }
}
