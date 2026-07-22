/**
 * Empfang-Tab der Waidcup-Adminseite: Bezahlt-Tracking und Check-In in einer
 * Ansicht. Pro Person eine Zeile mit „Bezahlt" und „Anwesend" (bezahlt setzt heute
 * automatisch anwesend). Drei Filter:
 *   - „Heute" (Start): wer heute spielt und noch nicht eingecheckt ist (Zahlung egal;
 *     Stornierte ausgeblendet) – die Empfangsliste schrumpft beim Einchecken.
 *   - „Unbezahlt": alle Personen des Turniers mit offenem Betrag (auch andere Tage).
 *   - „Alle": das komplette Turnier inkl. CHF-Totals und Storniert-Spalte.
 * Suche und sortierbare Spalten. Im Look der Waidcup-Seite.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { WaidcupDeskPerson, WaidcupDeskResponse, WaidcupPaymentStatus } from "@tcw/shared";
import { waidcupApi } from "../../api/client.js";

type Filter = "today" | "unpaid" | "all";
type SortKey = "name" | "match" | "cost";
type SortDir = "asc" | "desc";

/** "2026-07-24" → "24.07.2026" (für die Überschrift). */
function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : day;
}

/** Match-Spalte: im Heute-Filter die heutige Startzeit, sonst das erste Match (Datum + Zeit). */
function matchLabel(person: WaidcupDeskPerson, filter: Filter): string {
  if (filter === "today") return person.todayMatchTime !== "" ? person.todayMatchTime : "—";
  if (person.firstMatchDate === "") return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(person.firstMatchDate);
  const date = m ? `${m[3]}.${m[2]}.` : person.firstMatchDate;
  return person.firstMatchTime !== "" ? `${date} ${person.firstMatchTime}` : date;
}

function matchSortValue(person: WaidcupDeskPerson, filter: Filter): string {
  if (filter === "today") return person.todayMatchTime === "" ? "99:99" : person.todayMatchTime;
  return person.firstMatchDate === "" ? "9999" : `${person.firstMatchDate} ${person.firstMatchTime}`;
}

/** Platznummern natürlich sortieren ("Platz 2" vor "Platz 10"); ohne Platz ans Ende. */
function courtSortKey(court: string): number {
  const m = /\d+/.exec(court);
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER;
}

function comparePersons(a: WaidcupDeskPerson, b: WaidcupDeskPerson, key: SortKey, filter: Filter): number {
  if (key === "cost") return a.cost - b.cost || a.name.localeCompare(b.name);
  if (key === "match") {
    const byMatch = matchSortValue(a, filter).localeCompare(matchSortValue(b, filter));
    if (byMatch !== 0) return byMatch;
    // Im Heute-Blick nach Uhrzeit, darunter nach Platz.
    if (filter === "today") {
      const byCourt = courtSortKey(a.todayMatchCourt) - courtSortKey(b.todayMatchCourt);
      if (byCourt !== 0) return byCourt;
    }
    return a.name.localeCompare(b.name);
  }
  return a.name.localeCompare(b.name);
}

/** Zeile im aktiven Filter sichtbar? */
function inFilter(person: WaidcupDeskPerson, filter: Filter): boolean {
  if (filter === "today") return person.playsToday && !person.present && person.status !== "cancelled";
  if (filter === "unpaid") return person.status === "open";
  return true;
}

function rowClass(person: WaidcupDeskPerson): string | undefined {
  if (person.status === "cancelled") return "is-cancelled";
  if (person.status === "paid" || person.present) return "is-paid";
  return undefined;
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  numeric,
}: Readonly<{
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  numeric?: boolean;
}>): JSX.Element {
  let arrow = "";
  if (sortKey === col) arrow = sortDir === "asc" ? "▲" : "▼";
  return (
    <th className={numeric ? "numeric" : undefined}>
      <button type="button" className="sort-header" onClick={() => onSort(col)}>
        {label} {arrow !== "" ? <span className="wc-pay__sortarrow">{arrow}</span> : null}
      </button>
    </th>
  );
}

function FilterChip({
  active,
  count,
  label,
  onClick,
}: Readonly<{ active: boolean; count: number; label: string; onClick: () => void }>): JSX.Element {
  return (
    <button type="button" className={active ? "chip is-active" : "chip"} aria-pressed={active} onClick={onClick}>
      {label} ({count})
    </button>
  );
}

export function DeskPanel(): JSX.Element {
  const [data, setData] = useState<WaidcupDeskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("today");
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    waidcupApi.admin
      .desk()
      .then(setData)
      .catch(() => setError("Liste konnte nicht geladen werden."));
  }, []);

  const onSort = (col: SortKey): void => {
    if (col === sortKey) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(col);
      setSortDir("asc");
    }
  };

  const busyGuard = (personKey: string, run: () => Promise<void>): Promise<void> => {
    setSaving((prev) => new Set(prev).add(personKey));
    setError(null);
    return run().finally(() => {
      setSaving((prev) => {
        const copy = new Set(prev);
        copy.delete(personKey);
        return copy;
      });
    });
  };

  const changeStatus = (person: WaidcupDeskPerson, next: WaidcupPaymentStatus): Promise<void> => {
    if (person.status === next) return Promise.resolve();
    const previous = person.status;
    return busyGuard(person.personKey, async () => {
      try {
        await waidcupApi.admin.setPayment(person.personKey, next);
        setData((prev) => {
          if (!prev) return prev;
          // „bezahlt" checkt eine heute spielende Person serverseitig auch ein.
          const autoPresent = next === "paid" && person.playsToday;
          const persons = prev.persons.map((p) =>
            p.personKey === person.personKey
              ? { ...p, status: next, present: autoPresent ? true : p.present }
              : p,
          );
          let { totalOpen, totalPaid, totalCancelled } = prev;
          const move = (status: WaidcupPaymentStatus, sign: number): void => {
            const amount = sign * person.cost;
            if (status === "paid") totalPaid += amount;
            else if (status === "cancelled") totalCancelled += amount;
            else totalOpen += amount;
          };
          move(previous, -1);
          move(next, 1);
          return { ...prev, persons, totalOpen, totalPaid, totalCancelled };
        });
      } catch {
        setError("Speichern fehlgeschlagen.");
      }
    });
  };

  const setPresent = (person: WaidcupDeskPerson, present: boolean): Promise<void> => {
    if (person.present === present) return Promise.resolve();
    return busyGuard(person.personKey, async () => {
      try {
        await waidcupApi.admin.setCheckin(person.personKey, present);
        setData((prev) => {
          if (!prev) return prev;
          const persons = prev.persons.map((p) =>
            p.personKey === person.personKey ? { ...p, present } : p,
          );
          return { ...prev, persons };
        });
      } catch {
        setError("Speichern fehlgeschlagen.");
      }
    });
  };

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.persons
      .filter((p) => inFilter(p, filter))
      .filter((p) => needle === "" || p.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const cmp = comparePersons(a, b, sortKey, filter);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [data, search, filter, sortKey, sortDir]);

  const counts = useMemo(() => {
    const persons = data?.persons ?? [];
    return {
      today: persons.filter((p) => inFilter(p, "today")).length,
      unpaid: persons.filter((p) => inFilter(p, "unpaid")).length,
      all: persons.length,
    };
  }, [data]);

  if (error && !data) return <div className="wc-admin__note">{error}</div>;
  if (!data) return <div className="wc-admin__note">Lädt …</div>;

  const showMoney = filter !== "today"; // Storniert-Spalte + Totals nur im Geld-Blick
  const showCourt = filter === "today"; // Platz nur im Heute-Blick (heutiges Match)
  const colCount = 7;

  return (
    <div className="card wc-admin__card">
      <div className="card__head">Empfang · {dayLabel(data.day)}</div>
      <div className="wc-pay__body">
        <div className="tournament-filterbar">
          <input
            type="search"
            className="player-search"
            placeholder="Namen suchen …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <FilterChip active={filter === "today"} count={counts.today} label="Heute" onClick={() => setFilter("today")} />
          <FilterChip
            active={filter === "unpaid"}
            count={counts.unpaid}
            label="Unbezahlt"
            onClick={() => setFilter("unpaid")}
          />
          <FilterChip active={filter === "all"} count={counts.all} label="Alle · Turnier" onClick={() => setFilter("all")} />
        </div>

        {showMoney ? (
          <div className="wc-pay__totals">
            Offen: <strong>CHF {data.totalOpen}</strong>
            {filter === "all" ? (
              <>
                {" · "}Bezahlt: <strong>CHF {data.totalPaid}</strong> · Storniert:{" "}
                <strong>CHF {data.totalCancelled}</strong>
              </>
            ) : null}
          </div>
        ) : null}
        {error ? <div className="wc-admin__error">{error}</div> : null}

        <div className="table-wrap wc-pay__scroll">
          <table className="board">
            <thead>
              <tr>
                <SortHeader label="Name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th>Konkurrenz</th>
                <SortHeader
                  label={filter === "today" ? "Zeit" : "Erstes Match"}
                  col="match"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                {showCourt ? <th>Platz</th> : null}
                <SortHeader label="Kosten" col="cost" sortKey={sortKey} sortDir={sortDir} onSort={onSort} numeric />
                <th className="numeric">Bezahlt</th>
                <th className="numeric">Anwesend</th>
                {showMoney ? <th className="numeric">Storniert</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => {
                const busy = saving.has(person.personKey);
                return (
                  <tr key={person.personKey} className={rowClass(person)}>
                    <td>{person.name}</td>
                    <td className="wc-pay__disc">{person.disciplines.join(" · ")}</td>
                    <td>{matchLabel(person, filter)}</td>
                    {showCourt ? <td>{person.todayMatchCourt !== "" ? person.todayMatchCourt : "—"}</td> : null}
                    <td className="numeric">CHF {person.cost}</td>
                    <td className="numeric">
                      <input
                        type="checkbox"
                        className="wc-pay__check"
                        checked={person.status === "paid"}
                        disabled={busy}
                        onChange={(event) => void changeStatus(person, event.target.checked ? "paid" : "open")}
                        aria-label={`${person.name} bezahlt`}
                      />
                    </td>
                    <td className="numeric">
                      {person.playsToday ? (
                        <input
                          type="checkbox"
                          className="wc-pay__check"
                          checked={person.present}
                          disabled={busy}
                          onChange={(event) => void setPresent(person, event.target.checked)}
                          aria-label={`${person.name} anwesend`}
                        />
                      ) : (
                        <span className="wc-pay__na" aria-label="spielt heute nicht">
                          —
                        </span>
                      )}
                    </td>
                    {showMoney ? (
                      <td className="numeric">
                        <input
                          type="checkbox"
                          className="wc-pay__check wc-pay__check--cancel"
                          checked={person.status === "cancelled"}
                          disabled={busy}
                          onChange={(event) => void changeStatus(person, event.target.checked ? "cancelled" : "open")}
                          aria-label={`${person.name} storniert`}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="wc-pay__empty">
                    {filter === "today" && counts.all > 0 ? "Alle eingecheckt oder keine Partien heute." : "Keine Einträge."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
