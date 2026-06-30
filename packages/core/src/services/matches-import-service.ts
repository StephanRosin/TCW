/**
 * Import der Spieltermine aus der Swisstennis-ClubResult-API.
 *
 * Ersetzt den bisherigen stündlichen `import_clubresult.py`-Cronjob. Idempotent:
 * Bei Erfolg werden die Spieltermine des Jahres atomar ersetzt; schlägt der
 * Abruf fehl, bleiben die bestehenden Daten erhalten.
 */
import { toErrorMessage } from "@tcw/shared";
import type { AppConfig } from "../config.js";
import type { TcwDatabase } from "../db/connection.js";
import { SwisstennisClient } from "../integrations/swisstennis/raw-client.js";
import { clubResultUrl, drawMetaByEncountUrl, normalizeYear } from "../integrations/swisstennis/urls.js";
import { asArray, cleanText, toNumber } from "../integrations/swisstennis/normalize.js";

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const NO_RESULT = "–:–";

interface RawScheduleMatch {
  HomeTeam?: { content?: string };
  VisitTeam?: { content?: string };
  validated?: number;
  Schedule?: { Month?: number; Day?: number; Hour?: number; Minute?: number };
  nbRound?: number;
  Ligue?: { Text?: string };
  id?: number;
  Date?: string;
  home?: boolean;
  Result?: { Text?: string };
}

interface ImportedMatch {
  year: string;
  round: string;
  date: string;
  time: string;
  liga: string;
  home: string;
  away: string;
  result: string;
  encountId: number;
  validated: number;
  isHomeOwn: number;
  playoff: number;
  playoffType: string;
  playoffTitle: string;
  playoffLigueId: number;
  sortMonth: number;
  sortDay: number;
  sortHour: number;
  sortMinute: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatTime(schedule: RawScheduleMatch["Schedule"]): string {
  if (!schedule || schedule.Hour == null) {
    return "";
  }
  return `${pad2(schedule.Hour)}:${pad2(schedule.Minute ?? 0)}`;
}

function formatResult(match: RawScheduleMatch): string {
  if (match.validated !== 1) {
    return NO_RESULT;
  }
  const text = cleanText(match.Result?.Text ?? "").replace(" : ", ":");
  return text || NO_RESULT;
}

function formatUpdatedAt(today: { day?: number; month?: number; year?: number } | undefined): string {
  if (!today || today.day == null || today.month == null || today.year == null) {
    return "";
  }
  const monthName = MONTHS_DE[today.month] ?? "";
  return monthName ? `${today.day}. ${monthName} ${today.year}` : "";
}

async function loadPlayoffMeta(
  client: SwisstennisClient,
  encountId: number,
  year: string,
): Promise<{ type: string; title: string; ligueId: number }> {
  if (encountId <= 0) {
    return { type: "", title: "", ligueId: 0 };
  }
  try {
    const payload = (await client.fetchData(drawMetaByEncountUrl("ic", encountId, year))) as {
      I2cm?: { DrawResults?: { Promotion?: number; Title?: string; LigueId?: number } };
    };
    const draw = payload.I2cm?.DrawResults;
    const promotion = toNumber(draw?.Promotion, -1);
    const type = promotion === 1 ? "promotion" : promotion === 0 ? "relegation" : "";
    return { type, title: cleanText(draw?.Title ?? ""), ligueId: toNumber(draw?.LigueId) };
  } catch {
    return { type: "", title: "", ligueId: 0 };
  }
}

async function toImportedMatch(
  raw: RawScheduleMatch,
  isPlayoff: boolean,
  year: string,
  client: SwisstennisClient,
): Promise<ImportedMatch> {
  const encountId = toNumber(raw.id);
  const playoffMeta = isPlayoff
    ? await loadPlayoffMeta(client, encountId, year)
    : { type: "", title: "", ligueId: 0 };
  const schedule = raw.Schedule;
  return {
    year,
    round: raw.nbRound == null ? "" : String(raw.nbRound),
    date: cleanText(raw.Date ?? ""),
    time: formatTime(schedule),
    liga: cleanText(raw.Ligue?.Text ?? ""),
    home: cleanText(raw.HomeTeam?.content ?? ""),
    away: cleanText(raw.VisitTeam?.content ?? ""),
    result: formatResult(raw),
    encountId,
    validated: raw.validated === 1 ? 1 : 0,
    isHomeOwn: raw.home ? 1 : 0,
    playoff: isPlayoff ? 1 : 0,
    playoffType: playoffMeta.type,
    playoffTitle: playoffMeta.title,
    playoffLigueId: playoffMeta.ligueId,
    sortMonth: toNumber(schedule?.Month, 99),
    sortDay: toNumber(schedule?.Day, 99),
    sortHour: toNumber(schedule?.Hour, 99),
    sortMinute: toNumber(schedule?.Minute, 99),
  };
}

function compareMatches(a: ImportedMatch, b: ImportedMatch): number {
  return (
    a.sortMonth - b.sortMonth ||
    a.sortDay - b.sortDay ||
    a.sortHour - b.sortHour ||
    a.sortMinute - b.sortMinute ||
    Number(a.round || 99) - Number(b.round || 99) ||
    a.playoff - b.playoff
  );
}

function writeMatches(
  database: TcwDatabase,
  year: string,
  matches: ImportedMatch[],
  updatedAt: string,
): void {
  const insert = database.prepare(
    `INSERT INTO matches (year, round, date, time, liga, home, away, result, encount_id, validated, is_home_own, playoff, playoff_type, playoff_title, playoff_ligue_id, sort_index)
     VALUES (@year, @round, @date, @time, @liga, @home, @away, @result, @encountId, @validated, @isHomeOwn, @playoff, @playoffType, @playoffTitle, @playoffLigueId, @sortIndex)`,
  );
  const run = database.transaction(() => {
    database.prepare("DELETE FROM matches WHERE year = ?").run(year);
    matches.forEach((match, index) => insert.run({ ...match, sortIndex: index }));
    database
      .prepare(
        `INSERT INTO import_state (key, updated_at, source, last_run_at, last_error)
         VALUES ('matches', @updatedAt, 'clubresult-json', @now, '')
         ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, source = excluded.source, last_run_at = excluded.last_run_at, last_error = ''`,
      )
      .run({ updatedAt, now: new Date().toISOString() });
  });
  run();
}

function recordImportError(database: TcwDatabase, message: string): void {
  database
    .prepare(
      `INSERT INTO import_state (key, updated_at, source, last_run_at, last_error)
       VALUES ('matches', '', 'clubresult-json', @now, @error)
       ON CONFLICT(key) DO UPDATE SET last_run_at = excluded.last_run_at, last_error = excluded.last_error`,
    )
    .run({ now: new Date().toISOString(), error: message });
}

export interface MatchesImporter {
  importMatches(year?: string): Promise<number>;
}

export function createMatchesImporter(config: AppConfig, database: TcwDatabase): MatchesImporter {
  // TTL 0: jeder Import holt frische Daten; bei Fehlern greift der Stale-Fallback.
  const client = new SwisstennisClient(0, config.swisstennisTimeoutMs);

  return {
    async importMatches(yearInput) {
      const year = normalizeYear(yearInput);
      try {
        const payload = (await client.fetchData(clubResultUrl("ic", year))) as {
          I2cm?: {
            Today?: { day?: number; month?: number; year?: number };
            Encounts?: { Encount?: unknown };
            Tableaux?: { Encount?: unknown };
          };
        };
        const root = payload.I2cm ?? {};
        const group = asArray<RawScheduleMatch>(root.Encounts?.Encount as never);
        const tableaux = asArray<RawScheduleMatch>(root.Tableaux?.Encount as never);

        const matches: ImportedMatch[] = [];
        for (const raw of group) {
          matches.push(await toImportedMatch(raw, false, year, client));
        }
        for (const raw of tableaux) {
          matches.push(await toImportedMatch(raw, true, year, client));
        }
        if (matches.length === 0) {
          throw new Error("ClubResult lieferte keine Spieltermine.");
        }
        matches.sort(compareMatches);
        writeMatches(database, year, matches, formatUpdatedAt(root.Today));
        return matches.length;
      } catch (error) {
        recordImportError(database, toErrorMessage(error));
        throw error;
      }
    },
  };
}
