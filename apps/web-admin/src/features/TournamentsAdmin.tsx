/**
 * Turnierkonfiguration pflegen (Name, SwissTennis-ID, aktiv, Reihenfolge).
 * Anmeldelink und Kategorien werden automatisch ermittelt. Pro Turnier kann
 * ein Refresh ausgelöst werden; Status zeigt letzten Import und Fehler.
 */
import { useEffect, useState, type JSX } from "react";
import type { AdminTournament } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { useAsync } from "../useAsync.js";
import { useMutation } from "../useMutation.js";
import { StatusMessage } from "../components/Status.js";

type TournamentDraft = Pick<
  AdminTournament,
  "id" | "name" | "swisstennisTournamentId" | "active" | "sortOrder" | "updatedAt" | "lastError"
>;

function emptyDraft(sortOrder: number): TournamentDraft {
  return { id: 0, name: "", swisstennisTournamentId: 0, active: true, sortOrder, updatedAt: "", lastError: "" };
}

export function TournamentsAdmin(): JSX.Element {
  const { data, loading, error, reload } = useAsync(adminApi.tournaments);
  const { status, busy, run, fail } = useMutation(reload);
  const [drafts, setDrafts] = useState<TournamentDraft[]>([]);

  useEffect(() => {
    if (data) setDrafts(data);
  }, [data]);

  const update = (index: number, patch: Partial<TournamentDraft>): void => {
    setDrafts((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const saveAll = (): void => {
    void run(
      () =>
        adminApi.saveTournaments(
          drafts.map((row, index) => ({
            name: row.name,
            swisstennis_tournament_id: row.swisstennisTournamentId,
            active: row.active ? 1 : 0,
            sort_order: index,
          })),
        ),
      "Turniere gespeichert. Import läuft im Hintergrund.",
    );
  };

  const refresh = (row: TournamentDraft): void => {
    if (row.swisstennisTournamentId <= 0) {
      fail("Bitte zuerst eine gültige Turnier-ID setzen und speichern.");
      return;
    }
    void run(() => adminApi.refreshTournament(row.swisstennisTournamentId), "Turnier aktualisiert.");
  };

  if (loading) return <p className="muted">Lädt…</p>;
  if (error) return <div className="msg msg--err">{error}</div>;

  return (
    <div>
      <h2>Turniere</h2>
      <p className="hint">Der Anmeldelink (mytennis.ch) und die Kategorien werden automatisch ermittelt.</p>
      <StatusMessage status={status} />
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>SwissTennis-ID</th>
              <th>Aktiv</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((row, index) => (
              <tr key={`${row.id}-${index}`}>
                <td><input value={row.name} onChange={(e) => update(index, { name: e.target.value })} /></td>
                <td>
                  <input
                    type="number"
                    value={row.swisstennisTournamentId || ""}
                    onChange={(e) => update(index, { swisstennisTournamentId: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <select value={row.active ? "1" : "0"} onChange={(e) => update(index, { active: e.target.value === "1" })}>
                    <option value="1">Ja</option>
                    <option value="0">Nein</option>
                  </select>
                </td>
                <td className="muted">
                  {row.updatedAt ? `Stand: ${row.updatedAt.slice(0, 16).replace("T", " ")}` : "noch kein Import"}
                  {row.lastError ? <div className="msg--err">Fehler: {row.lastError}</div> : null}
                </td>
                <td className="actions-cell">
                  <button className="btn" disabled={busy} onClick={() => refresh(row)}>Refresh</button>
                  <button className="btn btn--danger" onClick={() => setDrafts((c) => c.filter((_, i) => i !== index))}>Entfernen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar toolbar--top-gap">
        <button className="btn" onClick={() => setDrafts((c) => [...c, emptyDraft(c.length)])}>Turnier hinzufügen</button>
        <button className="btn btn--primary" disabled={busy} onClick={saveAll}>Alles speichern</button>
      </div>
    </div>
  );
}
