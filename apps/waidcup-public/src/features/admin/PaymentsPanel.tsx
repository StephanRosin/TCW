/**
 * Bezahlt-Tracking-Tab der Waidcup-Adminseite: pro Person eine Zeile mit
 * Konkurrenzen, erstem Match, zu zahlendem Betrag und einem „bezahlt"-Haken.
 * Suche, Filter (unbezahlt/alle) und sortierbare Spalten.
 */
import { useEffect, useMemo, useState, type JSX } from "react";
import type { WaidcupPaymentPerson, WaidcupPaymentsResponse } from "@tcw/shared";
import { waidcupApi } from "../../api/client.js";

type SortKey = "name" | "match" | "cost";
type SortDir = "asc" | "desc";

/** "2026-07-18"/"12:00" → "18.07. 12:00"; leer → "—". */
function matchLabel(person: WaidcupPaymentPerson): string {
  if (person.firstMatchDate === "") return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(person.firstMatchDate);
  const date = m ? `${m[3]}.${m[2]}.` : person.firstMatchDate;
  return person.firstMatchTime !== "" ? `${date} ${person.firstMatchTime}` : date;
}

/** Sortwert des ersten Matches; ohne Termin ans Ende. */
function matchSortValue(person: WaidcupPaymentPerson): string {
  return person.firstMatchDate === "" ? "9999" : `${person.firstMatchDate} ${person.firstMatchTime}`;
}

function comparePersons(a: WaidcupPaymentPerson, b: WaidcupPaymentPerson, key: SortKey): number {
  if (key === "cost") return a.cost - b.cost || a.name.localeCompare(b.name);
  if (key === "match") return matchSortValue(a).localeCompare(matchSortValue(b)) || a.name.localeCompare(b.name);
  return a.name.localeCompare(b.name);
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
  const arrow = sortKey === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th className={numeric ? "wc-pay__num" : undefined}>
      <button type="button" className="wc-pay__sort" onClick={() => onSort(col)}>
        {label}
        {arrow}
      </button>
    </th>
  );
}

export function PaymentsPanel(): JSX.Element {
  const [data, setData] = useState<WaidcupPaymentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    waidcupApi.admin
      .payments()
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

  const togglePaid = async (person: WaidcupPaymentPerson): Promise<void> => {
    const next = !person.paid;
    setSaving((prev) => new Set(prev).add(person.personKey));
    setError(null);
    try {
      await waidcupApi.admin.setPayment(person.personKey, next);
      setData((prev) => {
        if (!prev) return prev;
        const persons = prev.persons.map((p) => (p.personKey === person.personKey ? { ...p, paid: next } : p));
        const delta = next ? person.cost : -person.cost;
        return { persons, totalPaid: prev.totalPaid + delta, totalOpen: prev.totalOpen - delta };
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
      .filter((p) => (onlyUnpaid ? !p.paid : true))
      .filter((p) => needle === "" || p.name.toLowerCase().includes(needle))
      .sort((a, b) => {
        const cmp = comparePersons(a, b, sortKey);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [data, search, onlyUnpaid, sortKey, sortDir]);

  if (error && !data) return <div className="wc-admin__error">{error}</div>;
  if (!data) return <div className="wc-pay__loading">Lädt …</div>;

  const openCount = data.persons.filter((p) => !p.paid).length;

  return (
    <div className="wc-pay">
      <div className="wc-pay__bar">
        <input
          type="search"
          className="wc-admin__input wc-pay__search"
          placeholder="Namen suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="wc-pay__filter">
          <button
            type="button"
            className={onlyUnpaid ? "wc-pay__chip is-active" : "wc-pay__chip"}
            onClick={() => setOnlyUnpaid(true)}
          >
            Unbezahlt ({openCount})
          </button>
          <button
            type="button"
            className={!onlyUnpaid ? "wc-pay__chip is-active" : "wc-pay__chip"}
            onClick={() => setOnlyUnpaid(false)}
          >
            Alle ({data.persons.length})
          </button>
        </div>
      </div>

      <div className="wc-pay__totals">
        Offen: <strong>CHF {data.totalOpen}</strong> · Bezahlt: <strong>CHF {data.totalPaid}</strong>
      </div>
      {error ? <div className="wc-admin__error">{error}</div> : null}

      <div className="wc-pay__scroll">
        <table className="wc-pay__table">
          <thead>
            <tr>
              <SortHeader label="Name" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <th>Konkurrenz</th>
              <SortHeader label="Erstes Match" col="match" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Kosten" col="cost" sortKey={sortKey} sortDir={sortDir} onSort={onSort} numeric />
              <th className="wc-pay__num">Bezahlt</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => (
              <tr key={person.personKey} className={person.paid ? "wc-pay__row--paid" : undefined}>
                <td>{person.name}</td>
                <td className="wc-pay__disc">{person.disciplines.join(" · ")}</td>
                <td>{matchLabel(person)}</td>
                <td className="wc-pay__num">CHF {person.cost}</td>
                <td className="wc-pay__num">
                  <input
                    type="checkbox"
                    className="wc-pay__check"
                    checked={person.paid}
                    disabled={saving.has(person.personKey)}
                    onChange={() => void togglePaid(person)}
                    aria-label={`${person.name} bezahlt`}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="wc-pay__empty">
                  Keine Einträge.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
