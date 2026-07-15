/**
 * Helfer.innen-Einsatzplan-Tab: zeigt den Schichtplan (Tage × Zeitslots) mit
 * Namenssuche, Rollen-Legende und Download des Original-PDF.
 *
 * Darstellung viewport-abhängig: Desktop = volles Raster (horizontal scrollbar),
 * Mobile = Tag-Umschalter + Slot-Liste. Alle Texte (Rollen, Wochentage, Marker,
 * Tasks) sind i18n-Keys und werden hier übersetzt; nur Namen bleiben Klartext.
 */
import { useMemo, useState, type JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";
import { useIsMobile } from "../../hooks/useIsMobile.js";
import {
  DAYS,
  LEGEND_ROLES,
  PLAN_META,
  SLOTS,
  type DayLabel,
  type PlanCell,
  type PlanDay,
  type PlanNote,
} from "./planData.js";
import { findByName, matchedDayKeys, nameMatches } from "./search.js";

type Translate = (key: string) => string;

/** Marker-Text mit eingesetzten Platzhaltern ({a}/{b}). */
function formatNote(t: Translate, note: PlanNote): string {
  return t(note.key).replace("{a}", note.a ?? "").replace("{b}", note.b ?? "");
}
/** Tages-Label mit optionaler Nummer ({n}). */
function formatDayLabel(t: Translate, label: DayLabel): string {
  return t(label.key).replace("{n}", label.n ?? "");
}

/** Namen-Zeile mit optionaler Treffer-Hervorhebung; leere Namen als „—". */
function NameLine({ roleKey, names, query }: Readonly<{ roleKey: string; names: string; query: string }>): JSX.Element {
  const { t } = useI18n();
  const filled = names.trim() !== "";
  const highlight = filled && nameMatches(names, query);
  return (
    <div className={`helpers-line${highlight ? " helpers-line--hit" : ""}`}>
      <span className="helpers-line__role">{t(`helpers.role.${roleKey}`)}</span>
      <span className={`helpers-line__names${filled ? "" : " helpers-line__names--empty"}`}>
        {filled ? names : "—"}
      </span>
    </div>
  );
}

/** Inhalt einer Zelle (Marker + Rollen-Zeilen). */
function CellBody({ cell, query }: Readonly<{ cell: PlanCell; query: string }>): JSX.Element {
  const { t } = useI18n();
  return (
    <>
      {cell.note ? <div className="helpers-cell__note">{formatNote(t, cell.note)}</div> : null}
      {cell.lines.map((line, index) => (
        <NameLine key={`${line.role}-${index}`} roleKey={line.role} names={line.names} query={query} />
      ))}
    </>
  );
}

/** Desktop-Raster: sticky Zeit-Spalte, horizontal scrollbar über alle Tage. */
function PlanGrid({ query, matchedDays }: Readonly<{ query: string; matchedDays: ReadonlySet<string> }>): JSX.Element {
  const { t } = useI18n();
  const hasQuery = query.trim() !== "";
  return (
    <section className="helpers-grid__scroll" aria-label={t("helpers.gridLabel")} tabIndex={0}>
      <table className="helpers-grid">
        <thead>
          <tr>
            <th className="helpers-grid__timehead" scope="col">
              {t("helpers.timeColumn")}
            </th>
            {DAYS.map((day) => (
              <th
                key={day.key}
                scope="col"
                className={`helpers-grid__dayhead${hasQuery && matchedDays.has(day.key) ? " helpers-grid__dayhead--hit" : ""}`}
              >
                <span className="helpers-grid__weekday">{t(day.weekdayKey)}</span>
                <span className="helpers-grid__date">{day.date}</span>
                <span className="helpers-grid__daylabel">{formatDayLabel(t, day.label)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th className="helpers-grid__time" scope="row">
                {slot}
              </th>
              {DAYS.map((day) => {
                const cell = day.cells[slot];
                return (
                  <td key={day.key} className="helpers-grid__cell">
                    {cell ? <CellBody cell={cell} query={query} /> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Mobile-Ansicht: ein Tag als Liste, mit Tag-Umschalter darüber. */
function PlanDayList({ query, matchedDays }: Readonly<{ query: string; matchedDays: ReadonlySet<string> }>): JSX.Element {
  const { t } = useI18n();
  const [dayKey, setDayKey] = useState<string>(DAYS[0]!.key);
  const day: PlanDay = DAYS.find((d) => d.key === dayKey) ?? DAYS[0]!;
  const hasQuery = query.trim() !== "";
  const filledSlots = SLOTS.filter((slot) => day.cells[slot]);

  return (
    <div className="helpers-daylist">
      <div className="helpers-daypicker" role="tablist" aria-label={t("helpers.dayPickerLabel")}>
        {DAYS.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={d.key === dayKey}
            className={`helpers-daypicker__btn${d.key === dayKey ? " is-active" : ""}${
              hasQuery && matchedDays.has(d.key) ? " has-hit" : ""
            }`}
            onClick={() => setDayKey(d.key)}
          >
            <span className="helpers-daypicker__wd">{t(d.weekdayKey).slice(0, 2)}</span>
            <span className="helpers-daypicker__dt">{d.date.slice(0, 5)}</span>
          </button>
        ))}
      </div>

      <div className="helpers-daylist__head">
        <strong>
          {t(day.weekdayKey)}, {day.date}
        </strong>
        <span className="helpers-daylist__label">{formatDayLabel(t, day.label)}</span>
      </div>

      {filledSlots.length === 0 ? (
        <p className="helpers-empty">{t("helpers.dayEmpty")}</p>
      ) : (
        filledSlots.map((slot) => (
          <div key={slot} className="helpers-slotcard">
            <div className="helpers-slotcard__time">{slot}</div>
            <div className="helpers-slotcard__body">
              <CellBody cell={day.cells[slot]!} query={query} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function HelpersView(): JSX.Element {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => findByName(DAYS, SLOTS, query), [query]);
  const matchedDays = useMemo(() => matchedDayKeys(matches), [matches]);
  const hasQuery = query.trim() !== "";
  const pdfUrl = `/${PLAN_META.pdfFile}`;

  return (
    <section className="helpers">
      <header className="helpers__head">
        <div>
          <h2 className="helpers__title">{t("helpers.title")}</h2>
          <p className="helpers__subtitle">
            {t("helpers.subtitle")}
            {PLAN_META.provisional ? <span className="helpers__badge">{t("helpers.provisional")}</span> : null}
          </p>
        </div>
        <a className="helpers__download" href={pdfUrl} download target="_blank" rel="noopener noreferrer">
          ⬇ {t("helpers.downloadPdf")}
        </a>
      </header>

      <div className="helpers__search">
        <input
          type="search"
          className="helpers__searchinput"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("helpers.searchPlaceholder")}
          aria-label={t("helpers.searchPlaceholder")}
        />
        {hasQuery ? (
          <div className="helpers__results">
            {matches.length === 0 ? (
              <p className="helpers__noresults">{t("helpers.noResults")}</p>
            ) : (
              <>
                <p className="helpers__resultcount">{t("helpers.resultCount").replace("{n}", String(matches.length))}</p>
                <ul className="helpers__resultlist">
                  {matches.map((match, index) => (
                    <li key={`${match.dayKey}-${match.slot}-${match.roleKey}-${index}`}>
                      <span className="helpers__resultname">{match.name}</span>
                      <span className="helpers__resultmeta">
                        {t(match.weekdayKey)} {match.date} · {match.slot} · {t(`helpers.role.${match.roleKey}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}
      </div>

      <details className="helpers__legend">
        <summary>{t("helpers.legendTitle")}</summary>
        <div className="helpers__legendbody">
          <ul className="helpers__tasks">
            {LEGEND_ROLES.map((role) => (
              <li key={role}>
                <strong>{t(`helpers.role.${role}`)}:</strong> {t(`helpers.task.${role}`)}
              </li>
            ))}
          </ul>
          <p className="helpers__general">{t("helpers.general")}</p>
        </div>
      </details>

      {isMobile ? (
        <PlanDayList query={query} matchedDays={matchedDays} />
      ) : (
        <PlanGrid query={query} matchedDays={matchedDays} />
      )}
    </section>
  );
}
