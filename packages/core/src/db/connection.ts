/**
 * SQLite-Verbindung des TCW Spielbetriebs.
 *
 * Eine geöffnete Verbindung pro Prozess. Fremdschlüssel sind aktiv, WAL sorgt
 * für gleichzeitige Lese-/Schreibzugriffe von Public- und Admin-Prozess.
 */
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";

export type TcwDatabase = Database.Database;

export interface DatabaseOptions {
  /** Pfad zur SQLite-Datei. */
  filePath: string;
  /** Nur lesend öffnen (für den Public-Prozess empfohlen). */
  readonly?: boolean;
}

/**
 * Öffnet die Datenbank, wendet die Pragmas an und stellt das Schema sicher.
 * Bei `readonly` wird das Schema nicht verändert (Public-Prozess).
 */
export function openDatabase(options: DatabaseOptions): TcwDatabase {
  if (!options.readonly) {
    mkdirSync(dirname(options.filePath), { recursive: true });
  }
  const database = new Database(options.filePath, { readonly: options.readonly ?? false });
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  if (!options.readonly) {
    database.exec(SCHEMA_SQL);
  }
  return database;
}
