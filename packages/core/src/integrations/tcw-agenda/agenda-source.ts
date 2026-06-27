/**
 * Liest die Vereins-Agenda von tcwaidberg.ch.
 *
 * Die Seite (Fairgate) rendert clientseitig, hält die Events aber als JSON
 * (`var eventsData = [...]`) im HTML. Dieses Array wird extrahiert und in
 * stabile Datensätze normalisiert. Die Datums-/Zeitformatierung folgt exakt
 * der Darstellung auf der Vereinsseite.
 */
const AGENDA_URL = "https://tcwaidberg.ch/agenda";
const EVENTS_MARKER = "var eventsData = ";

export interface AgendaEventRecord {
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  dateLabel: string;
  registrationLabel: string;
  category: string;
  detailUrl: string;
}

interface RawAgendaEvent {
  eventId?: string;
  eventTitle?: string;
  earliestStartDate?: string;
  latestEndDate?: string;
  isFullDay?: boolean;
  subscriptionAvailable?: number | string;
  subscriptionEndDate?: string;
  category?: unknown;
  detailsUrl?: string;
}

/** Extrahiert das balancierte `eventsData`-Array aus dem HTML (string-aware). */
function extractEventsArray(html: string): RawAgendaEvent[] {
  const markerIndex = html.indexOf(EVENTS_MARKER);
  if (markerIndex < 0) {
    return [];
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let index = markerIndex + EVENTS_MARKER.length; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "[") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(html.slice(start, index + 1)) as RawAgendaEvent[];
      }
    }
  }
  return [];
}

interface DateParts {
  date: string;
  time: string;
}

function splitDateTime(raw: string): DateParts {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) {
    return { date: raw, time: "" };
  }
  return { date: `${match[3]}.${match[2]}.${match[1]}`, time: `${match[4]}:${match[5]}` };
}

/** Erzeugt das Datumslabel exakt wie auf der Vereinsseite. */
function buildDateLabel(start: string, end: string, isFullDay: boolean): string {
  const from = splitDateTime(start);
  const to = splitDateTime(end);
  const sameDay = from.date === to.date;
  if (isFullDay) {
    return sameDay ? from.date : `${from.date} - ${to.date}`;
  }
  if (sameDay) {
    return `${from.date} ${from.time} - ${to.time}`;
  }
  return `${from.date} ${from.time} - ${to.date}`;
}

function buildRegistrationLabel(
  subscriptionAvailable: number | string | undefined,
  subscriptionEndDate: string | undefined,
  today: string,
): string {
  if (Number(subscriptionAvailable) !== 1) {
    return "";
  }
  const match = (subscriptionEndDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return "";
  }
  const deadlineIso = `${match[1]}-${match[2]}-${match[3]}`;
  if (deadlineIso < today) {
    return "";
  }
  return `Anmeldung möglich bis ${match[3]}.${match[2]}.${match[1]}`;
}

function categoryTitle(category: unknown): string {
  if (category && typeof category === "object") {
    const first = Object.values(category as Record<string, unknown>)[0];
    if (first && typeof first === "object" && "title" in first) {
      return String((first as { title: unknown }).title ?? "");
    }
  }
  return "";
}

/** Normalisiert die rohen Events; `today` = "YYYY-MM-DD" für die Anmeldefrist. */
export function normalizeAgendaEvents(raw: RawAgendaEvent[], today: string): AgendaEventRecord[] {
  return raw
    .filter((event) => event.eventId && event.eventTitle && event.earliestStartDate && event.latestEndDate)
    .map((event) => {
      const start = String(event.earliestStartDate);
      const end = String(event.latestEndDate);
      const isFullDay = event.isFullDay === true;
      const detailsPath = String(event.detailsUrl ?? "");
      return {
        eventId: String(event.eventId),
        title: String(event.eventTitle).trim(),
        startDate: start,
        endDate: end,
        isFullDay,
        dateLabel: buildDateLabel(start, end, isFullDay),
        registrationLabel: buildRegistrationLabel(event.subscriptionAvailable, event.subscriptionEndDate, today),
        category: categoryTitle(event.category),
        detailUrl: detailsPath ? `https://tcwaidberg.ch${detailsPath}` : "",
      };
    });
}

/** Lädt die Agenda-Seite und liefert die normalisierten Events. */
export async function fetchAgendaEvents(timeoutMs: number, today: string): Promise<AgendaEventRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(AGENDA_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TCW-Spielbetrieb/1.0)" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Agenda-Seite antwortete mit HTTP ${response.status}`);
    }
    const html = await response.text();
    return normalizeAgendaEvents(extractEventsArray(html), today);
  } finally {
    clearTimeout(timeout);
  }
}
