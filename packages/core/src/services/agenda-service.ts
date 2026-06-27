/**
 * Vereins-Agenda: täglicher Import von tcwaidberg.ch und öffentliche Anzeige.
 *
 * Angezeigt werden nur laufende oder bevorstehende Events (Enddatum ≥ jetzt),
 * sortiert nach Startdatum. Bei Importfehlern bleiben die alten Daten erhalten.
 */
import { toErrorMessage, type AgendaEvent, type AgendaResponse } from "@tcw/shared";
import type { AppConfig } from "../config.js";
import type { TcwDatabase } from "../db/connection.js";
import { fetchAgendaEvents, type AgendaEventRecord } from "../integrations/tcw-agenda/agenda-source.js";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
function localDateIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function localDateTime(date: Date): string {
  return `${localDateIso(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function writeAgenda(database: TcwDatabase, events: AgendaEventRecord[]): void {
  const insert = database.prepare(
    `INSERT INTO agenda_events (event_id, title, start_date, end_date, is_full_day, date_label, registration_label, category, detail_url, sort_order, updated_at)
     VALUES (@event_id, @title, @start_date, @end_date, @is_full_day, @date_label, @registration_label, @category, @detail_url, @sort_order, @updated_at)`,
  );
  const now = new Date().toISOString();
  database.transaction(() => {
    database.prepare("DELETE FROM agenda_events").run();
    events.forEach((event, index) => {
      insert.run({
        event_id: event.eventId,
        title: event.title,
        start_date: event.startDate,
        end_date: event.endDate,
        is_full_day: event.isFullDay ? 1 : 0,
        date_label: event.dateLabel,
        registration_label: event.registrationLabel,
        category: event.category,
        detail_url: event.detailUrl,
        sort_order: index,
        updated_at: now,
      });
    });
    database
      .prepare(
        `INSERT INTO import_state (key, updated_at, source, last_run_at, last_error)
         VALUES ('agenda', @updated_at, 'tcw-agenda', @now, '')
         ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, source = excluded.source, last_run_at = excluded.last_run_at, last_error = ''`,
      )
      .run({ updated_at: now, now });
  })();
}

function recordAgendaError(database: TcwDatabase, message: string): void {
  database
    .prepare(
      `INSERT INTO import_state (key, updated_at, source, last_run_at, last_error)
       VALUES ('agenda', '', 'tcw-agenda', @now, @error)
       ON CONFLICT(key) DO UPDATE SET last_run_at = excluded.last_run_at, last_error = excluded.last_error`,
    )
    .run({ now: new Date().toISOString(), error: message });
}

export interface AgendaImporter {
  importAgenda(): Promise<number>;
}

export function createAgendaImporter(config: AppConfig, database: TcwDatabase): AgendaImporter {
  return {
    async importAgenda() {
      try {
        const events = await fetchAgendaEvents(config.swisstennisTimeoutMs, localDateIso(new Date()));
        if (events.length === 0) {
          throw new Error("Agenda lieferte keine Events.");
        }
        writeAgenda(database, events);
        return events.length;
      } catch (error) {
        recordAgendaError(database, toErrorMessage(error));
        throw error;
      }
    },
  };
}

interface AgendaRow {
  title: string;
  date_label: string;
  registration_label: string;
  category: string;
  detail_url: string;
}

function toAgendaEvent(row: AgendaRow): AgendaEvent {
  return {
    dateLabel: row.date_label,
    title: row.title,
    category: row.category,
    registrationLabel: row.registration_label,
    detailUrl: row.detail_url,
  };
}

/** Laufende und bevorstehende Events (Enddatum ≥ jetzt), nach Startdatum sortiert. */
export function getPublicAgenda(database: TcwDatabase): AgendaResponse {
  const rows = database
    .prepare(
      "SELECT title, date_label, registration_label, category, detail_url FROM agenda_events WHERE end_date >= ? ORDER BY start_date ASC, sort_order ASC",
    )
    .all(localDateTime(new Date())) as AgendaRow[];
  const importState = database
    .prepare("SELECT updated_at FROM import_state WHERE key = 'agenda'")
    .get() as { updated_at: string } | undefined;
  return { events: rows.map(toAgendaEvent), updatedAt: importState?.updated_at ?? "" };
}
