/**
 * Check-In-Tab der Waidcup-Adminseite: listet alle Personen, die HEUTE ein Match
 * haben, mit Anwesend-Haken. Angehakt → aus der Liste ausgeblendet (analog zum
 * Bezahlt-Tab). Suche, Filter (ausstehend/alle) und sortierbare Spalten. Wird ein
 * Spieler im Bezahlt-Tab auf „bezahlt" gesetzt, erscheint er hier bereits als
 * anwesend (der Server setzt das Häkchen für heute automatisch).
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { WaidcupCheckinPerson, WaidcupCheckinResponse } from "@tcw/shared";
import { waidcupApi } from "../../api/client.js";

type SortKey = "name" | "time";
type SortDir = "asc" | "desc";

function timeLabel(person: WaidcupCheckinPerson): string {
  return person.matchTime !== "" ? person.matchTime : "—";
}

function timeSortValue(person: WaidcupCheckinPerson): string {
  return person.matchTime === "" ? "99:99" : person.matchTime;
}

function comparePersons(a: WaidcupCheckinPerson, b: WaidcupCheckinPerson, key: SortKey): number {
  if (key === "time") return timeSortValue(a).localeCompare(timeSortValue(b)) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
}

function SortHeader({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: Readonly<{
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
}>): JSX.Element {
  let arrow = "";
  if (sortKey === col) arrow = sortDir === "asc" ? "▲" : "▼";
  return (
    <th>
      <button type="button" className="sort-header" onClick={() => onSort(col)}>
        {label} {arrow !== "" ? <span className="wc-pay__sortarrow">{arrow}</span> : null}
      </button>
    </th>
  );
}

/** "2026-07-21" → "21.07.2026" (für die Überschrift). */
function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : day;
}

export function CheckinPanel(): JSX.Element {
  const [data, setData] = useState<WaidcupCheckinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyAbsent, setOnlyAbsent] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    waidcupApi.admin
      .checkin()
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

  const setPresent = async (person: WaidcupCheckinPerson, present: boolean): Promise<void> => {
    if (person.present === present) return;
    setSaving((prev) => new Set(prev).add(person.personKey));
    setError(null);
    try {
      await waidcupApi.admin.setCheckin(person.personKey, present);
      setData((prev) => {
        if (!prev) return prev;
        const persons = prev.persons.map((p) =>
          p.personKey === person.personKey ? { ...p, present } : p,
        );
        return { ...prev, persons, presentCount: prev.presentCount + (present ? 1 : -1) };
      });
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving((prev) => {
        const copy = new Set(prev);
        copy.delete(person.personKey);
        return copy;
      });
    }
  };

  const visible = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.persons
      .filter((p) => (onlyAbsent ? !p.present : true))
      .filter((p) => needle === "" || p.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const cmp = comparePersons(a, b, sortKey);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [data, search, onlyAbsent, sortKey, sortDir]);

  if (error && !data) return <div className="wc-admin__note">{error}</div>;
  if (!data) return <div className="wc-admin__note">Lädt …</div>;

  const absentCount = data.totalCount - data.presentCount;

  return (
    <div className="card wc-admin__card">
      <div className="card__head">Check-In · {dayLabel(data.day)}</div>
      <div className="wc-pay__body">
        <div className="tournament-filterbar">
          <input
            type="search"
            className="player-search"
            placeholder="Namen suchen …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className={onlyAbsent ? "chip is-active" : "chip"}
            aria-pressed={onlyAbsent}
            onClick={() => setOnlyAbsent(true)}
          >
            Ausstehend ({absentCount})
          </button>
          <button
            type="button"
            className={!onlyAbsent ? "chip is-active" : "chip"}
            aria-pressed={!onlyAbsent}
            onClick={() => setOnlyAbsent(false)}
          >
            Alle ({data.totalCount})
          </button>
        </div>

        <div className="wc-pay__totals">
          Anwesend: <strong>{data.presentCount}</strong> / {data.totalCount}
        </div>
        {error ? <div className="wc-admin__error">{error}</div> : null}

        <div className="table-wrap wc-pay__scroll">
          <table className="board">
            <thead>
              <tr>
                <SortHeader label="Name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHeader label="Erstes Match" col="time" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <th className="numeric">Anwesend</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => {
                const busy = saving.has(person.personKey);
                return (
                  <tr key={person.personKey} className={person.present ? "is-paid" : undefined}>
                    <td>{person.name}</td>
                    <td>{timeLabel(person)}</td>
                    <td className="numeric">
                      <input
                        type="checkbox"
                        className="wc-pay__check"
                        checked={person.present}
                        disabled={busy}
                        onChange={(event) => void setPresent(person, event.target.checked)}
                        aria-label={`${person.name} anwesend`}
                      />
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={3} className="wc-pay__empty">
                    {onlyAbsent && data.totalCount > 0 ? "Alle anwesend." : "Keine Partien heute."}
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
