/**
 * Spieler pflegen. Neuer Spieler oder geänderter Name löst serverseitig eine
 * MyTennis-Suche aus (Klassierung/Profil-URL werden übernommen).
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { CAPTAIN_STATUS, type AdminTeam } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { useAsync } from "../useAsync.js";
import { useMutation } from "../useMutation.js";
import { StatusMessage } from "../components/Status.js";

interface MemberHit {
  id: number;
  displayName: string;
  klassierung: string | null;
  profileUrl: string | null;
}

const CAPTAIN_OPTIONS: Array<{ value: number; label: string }> = [
  { value: CAPTAIN_STATUS.none, label: "Kein Captain" },
  { value: CAPTAIN_STATUS.captain, label: "Captain" },
  { value: CAPTAIN_STATUS.viceCaptain, label: "Capt. Stv." },
];

interface PlayerDraft {
  id: number;
  name: string;
  klassierung: string;
  myTennisID: string;
  teamId: number;
  captainStatus: number;
}

function emptyPlayer(teamId: number): Omit<PlayerDraft, "id"> {
  return { name: "", klassierung: "", myTennisID: "", teamId, captainStatus: CAPTAIN_STATUS.none };
}

function toBody(player: Omit<PlayerDraft, "id">): Record<string, unknown> {
  return {
    name: player.name,
    klassierung: player.klassierung,
    myTennisID: player.myTennisID,
    team_id: player.teamId,
    captain_status: player.captainStatus,
  };
}

export function PlayersAdmin(): JSX.Element {
  const playersState = useAsync(adminApi.players);
  const teamsState = useAsync(adminApi.teams);
  const { status, busy, run } = useMutation(playersState.reload);
  const [drafts, setDrafts] = useState<PlayerDraft[]>([]);
  const [newPlayer, setNewPlayer] = useState<Omit<PlayerDraft, "id">>(emptyPlayer(0));
  const [memberHits, setMemberHits] = useState<MemberHit[]>([]);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (playersState.data) setDrafts(playersState.data);
  }, [playersState.data]);

  // Debounced Mitglieder-Suche fürs Namensfeld des "neuer Spieler"-Formulars;
  // manuelles Eintippen ohne Treffer bleibt weiterhin möglich.
  useEffect(() => () => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
  }, []);

  const onNameInput = (value: string): void => {
    setNewPlayer((p) => ({ ...p, name: value }));
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length < 2) {
      setMemberHits([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      void adminApi.memberSuggest(value).then((res) => setMemberHits(res.items));
    }, 250);
  };

  const pickMember = (hit: MemberHit): void => {
    setNewPlayer((p) => ({ ...p, name: hit.displayName, klassierung: hit.klassierung ?? "", myTennisID: hit.profileUrl ?? "" }));
    setMemberHits([]);
  };

  const teams: AdminTeam[] = teamsState.data ?? [];

  const updateDraft = (id: number, field: keyof PlayerDraft, value: string | number): void => {
    setDrafts((current) => current.map((player) => (player.id === id ? { ...player, [field]: value } : player)));
  };

  const remove = (player: PlayerDraft): void => {
    if (window.confirm("Spieler wirklich löschen?")) {
      void run(() => adminApi.deletePlayer(player.id), "Spieler gelöscht.");
    }
  };

  if (playersState.loading || teamsState.loading) return <p className="muted">Lädt…</p>;
  if (playersState.error) return <div className="msg msg--err">{playersState.error}</div>;

  const teamSelect = (value: number, onChange: (teamId: number) => void): JSX.Element => (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      <option value={0} disabled>– Team –</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>{team.displayName}</option>
      ))}
    </select>
  );

  return (
    <div>
      <h2>Spieler</h2>
      <p className="hint">Neuer Spieler oder geänderter Name löst automatisch eine MyTennis-Suche aus – das kann einen Moment dauern.</p>
      <StatusMessage status={status} />
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Klassierung</th>
              <th>Name</th>
              <th>MyTennis-Link</th>
              <th>Team</th>
              <th>Captain</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((player) => (
              <tr key={player.id}>
                <td><input value={player.klassierung} onChange={(e) => updateDraft(player.id, "klassierung", e.target.value)} /></td>
                <td><input value={player.name} onChange={(e) => updateDraft(player.id, "name", e.target.value)} /></td>
                <td><input value={player.myTennisID} onChange={(e) => updateDraft(player.id, "myTennisID", e.target.value)} /></td>
                <td>{teamSelect(player.teamId, (teamId) => updateDraft(player.id, "teamId", teamId))}</td>
                <td>
                  <select value={player.captainStatus} onChange={(e) => updateDraft(player.id, "captainStatus", Number(e.target.value))}>
                    {CAPTAIN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </td>
                <td className="actions-cell">
                  <button className="btn btn--primary" disabled={busy} onClick={() => run(() => adminApi.updatePlayer(player.id, toBody(player)), "Spieler gespeichert.")}>Speichern</button>
                  <button className="btn btn--danger" disabled={busy} onClick={() => remove(player)}>Löschen</button>
                </td>
              </tr>
            ))}
            <tr>
              <td><input value={newPlayer.klassierung} onChange={(e) => setNewPlayer({ ...newPlayer, klassierung: e.target.value })} /></td>
              <td className="member-suggest-wrap">
                <input
                  value={newPlayer.name}
                  autoComplete="off"
                  onChange={(e) => onNameInput(e.target.value)}
                  onBlur={() => setTimeout(() => setMemberHits([]), 150)}
                />
                {memberHits.length > 0 && (
                  <ul className="member-suggest-list">
                    {memberHits.map((hit) => (
                      <li key={hit.id}>
                        <button type="button" className="member-suggest-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pickMember(hit)}>
                          {hit.displayName}{hit.klassierung ? ` (${hit.klassierung})` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td><input value={newPlayer.myTennisID} onChange={(e) => setNewPlayer({ ...newPlayer, myTennisID: e.target.value })} /></td>
              <td>{teamSelect(newPlayer.teamId, (teamId) => setNewPlayer({ ...newPlayer, teamId }))}</td>
              <td>
                <select value={newPlayer.captainStatus} onChange={(e) => setNewPlayer({ ...newPlayer, captainStatus: Number(e.target.value) })}>
                  {CAPTAIN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </td>
              <td>
                <button className="btn btn--primary" disabled={busy} onClick={() => run(async () => {
                  await adminApi.createPlayer(toBody(newPlayer));
                  setNewPlayer(emptyPlayer(newPlayer.teamId));
                }, "Spieler angelegt.")}>Hinzufügen</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
