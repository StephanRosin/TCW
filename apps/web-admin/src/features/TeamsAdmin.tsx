/**
 * Teams pflegen: Geschlecht, Kategorie, Liga, Teamziel, Trainingstag.
 * Der Anzeigename ergibt sich automatisch und ist nicht editierbar.
 */
import { useEffect, useState, type JSX } from "react";
import { GENDERS, type AdminTeam } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { useAsync } from "../useAsync.js";
import { useMutation } from "../useMutation.js";
import { StatusMessage } from "../components/Status.js";

type TeamDraft = Pick<AdminTeam, "id" | "displayName" | "gender" | "category" | "liga" | "teamziel" | "trainingstag">;

const EMPTY_TEAM = { gender: "Damen", category: "", liga: "", teamziel: "", trainingstag: "" };

export function TeamsAdmin(): JSX.Element {
  const { data, loading, error, reload } = useAsync(adminApi.teams);
  const { status, busy, run } = useMutation(reload);
  const [drafts, setDrafts] = useState<TeamDraft[]>([]);
  const [newTeam, setNewTeam] = useState(EMPTY_TEAM);

  useEffect(() => {
    if (data) setDrafts(data);
  }, [data]);

  const updateDraft = (id: number, field: keyof TeamDraft, value: string): void => {
    setDrafts((current) => current.map((team) => (team.id === id ? { ...team, [field]: value } : team)));
  };

  const save = (team: TeamDraft): void => {
    void run(() => adminApi.updateTeam(team.id, team), `Team „${team.displayName}" gespeichert.`);
  };

  const remove = (team: TeamDraft): void => {
    if (window.confirm("Team wirklich löschen? Zugehörige Spieler werden mitgelöscht.")) {
      void run(() => adminApi.deleteTeam(team.id), "Team gelöscht.");
    }
  };

  const create = (): void => {
    void run(async () => {
      await adminApi.createTeam(newTeam);
      setNewTeam(EMPTY_TEAM);
    }, "Team angelegt.");
  };

  if (loading) return <p className="muted">Lädt…</p>;
  if (error) return <div className="msg msg--err">{error}</div>;

  return (
    <div>
      <h2>Teams</h2>
      <StatusMessage status={status} />
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Anzeigename</th>
              <th>Geschlecht</th>
              <th>Kategorie</th>
              <th>Liga</th>
              <th>Teamziel</th>
              <th>Trainingstag</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((team) => (
              <tr key={team.id}>
                <td className="muted">{team.displayName}</td>
                <td>
                  <select value={team.gender} onChange={(e) => updateDraft(team.id, "gender", e.target.value)}>
                    {GENDERS.map((gender) => (
                      <option key={gender}>{gender}</option>
                    ))}
                  </select>
                </td>
                <td><input value={team.category} onChange={(e) => updateDraft(team.id, "category", e.target.value)} /></td>
                <td><input value={team.liga} onChange={(e) => updateDraft(team.id, "liga", e.target.value)} /></td>
                <td><input value={team.teamziel} onChange={(e) => updateDraft(team.id, "teamziel", e.target.value)} /></td>
                <td><input value={team.trainingstag} onChange={(e) => updateDraft(team.id, "trainingstag", e.target.value)} /></td>
                <td className="actions-cell">
                  <button type="button" className="btn btn--primary" disabled={busy} onClick={() => save(team)}>Speichern</button>
                  <button type="button" className="btn btn--danger" disabled={busy} onClick={() => remove(team)}>Löschen</button>
                </td>
              </tr>
            ))}
            <tr>
              <td className="muted">neu</td>
              <td>
                <select value={newTeam.gender} onChange={(e) => setNewTeam({ ...newTeam, gender: e.target.value })}>
                  {GENDERS.map((gender) => (
                    <option key={gender}>{gender}</option>
                  ))}
                </select>
              </td>
              <td><input value={newTeam.category} onChange={(e) => setNewTeam({ ...newTeam, category: e.target.value })} /></td>
              <td><input value={newTeam.liga} onChange={(e) => setNewTeam({ ...newTeam, liga: e.target.value })} /></td>
              <td><input value={newTeam.teamziel} onChange={(e) => setNewTeam({ ...newTeam, teamziel: e.target.value })} /></td>
              <td><input value={newTeam.trainingstag} onChange={(e) => setNewTeam({ ...newTeam, trainingstag: e.target.value })} /></td>
              <td><button type="button" className="btn btn--primary" disabled={busy} onClick={create}>Hinzufügen</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
