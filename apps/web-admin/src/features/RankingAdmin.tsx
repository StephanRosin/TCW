/**
 * Klassierungsänderungen bearbeiten/löschen. Neue Einträge entstehen nur über
 * das Klassierungsupdate (Aktionen), nicht manuell.
 */
import { useEffect, useState, type JSX } from "react";
import { safeExternalUrl, type AdminRankingChange } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { useAsync } from "../useAsync.js";
import { useMutation } from "../useMutation.js";
import { StatusMessage } from "../components/Status.js";

export function RankingAdmin(): JSX.Element {
  const { data, loading, error, reload } = useAsync(adminApi.rankingChanges);
  const { status, busy, run } = useMutation(reload);
  const [drafts, setDrafts] = useState<AdminRankingChange[]>([]);

  useEffect(() => {
    if (data) setDrafts(data);
  }, [data]);

  const update = (id: number, field: "oldKlassierung" | "newKlassierung", value: string): void => {
    setDrafts((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const save = (row: AdminRankingChange): void => {
    void run(
      () =>
        adminApi.updateRankingChange(row.id, {
          player_name: row.playerName,
          myTennisID: row.myTennisID,
          old_klassierung: row.oldKlassierung,
          new_klassierung: row.newKlassierung,
          changed_at: row.changedAt,
        }),
      "Änderung gespeichert.",
    );
  };

  const remove = (row: AdminRankingChange): void => {
    if (window.confirm("Klassierungsänderung wirklich löschen?")) {
      void run(() => adminApi.deleteRankingChange(row.id), "Änderung gelöscht.");
    }
  };

  if (loading) return <p className="muted">Lädt…</p>;
  if (error) return <div className="msg msg--err">{error}</div>;

  return (
    <div>
      <h2>Klassierungsänderungen</h2>
      <StatusMessage status={status} />
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Klassierung neu</th>
              <th>Klassierung alt</th>
              <th>Datum</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((row) => {
              const url = safeExternalUrl(row.myTennisID);
              return (
                <tr key={row.id}>
                  <td>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{row.playerName}</a> : row.playerName}</td>
                  <td><input value={row.newKlassierung} onChange={(e) => update(row.id, "newKlassierung", e.target.value)} /></td>
                  <td><input value={row.oldKlassierung} onChange={(e) => update(row.id, "oldKlassierung", e.target.value)} /></td>
                  <td className="muted">{row.changedAt}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save(row)}>Speichern</button>
                    <button type="button" className="btn btn--danger" disabled={busy} onClick={() => remove(row)}>Löschen</button>
                  </td>
                </tr>
              );
            })}
            {drafts.length === 0 ? (
              <tr><td colSpan={5} className="muted">Keine Klassierungsänderungen vorhanden.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
