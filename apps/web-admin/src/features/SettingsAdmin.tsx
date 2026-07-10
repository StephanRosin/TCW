/**
 * Anzeige-Einstellungen: steuert die Sichtbarkeit einzelner Tabs der
 * öffentlichen Seite (Trainingsplan, Spieltermine).
 */
import { useEffect, useState, type JSX } from "react";
import type { SiteSettings } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { useAsync } from "../useAsync.js";
import { useMutation } from "../useMutation.js";
import { StatusMessage } from "../components/Status.js";

export function SettingsAdmin(): JSX.Element {
  const { data, loading, error, reload } = useAsync(adminApi.settings);
  const { status, busy, run } = useMutation(reload);
  const [draft, setDraft] = useState<SiteSettings>({ showTraining: false, showMatches: false });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = (): void => {
    void run(() => adminApi.saveSettings(draft), "Anzeige gespeichert.");
  };

  if (loading) {
    return <p>Lädt…</p>;
  }
  if (error) {
    return <div className="msg msg--err">{error}</div>;
  }

  return (
    <section>
      <h2>Anzeige der öffentlichen Seite</h2>
      <p>Bestimmt, welche Tabs für Besucher sichtbar sind. Ausgeblendete Bereiche bleiben in der Datenpflege erhalten.</p>
      <label className="settings-row">
        <input
          type="checkbox"
          checked={draft.showTraining}
          onChange={(event) => setDraft((current) => ({ ...current, showTraining: event.target.checked }))}
        />{" "}
        Trainingsplan anzeigen
      </label>
      <label className="settings-row">
        <input
          type="checkbox"
          checked={draft.showMatches}
          onChange={(event) => setDraft((current) => ({ ...current, showMatches: event.target.checked }))}
        />{" "}
        Spieltermine anzeigen
      </label>
      <div className="toolbar toolbar--top-gap">
        <button className="btn btn--primary" disabled={busy} onClick={save}>
          Speichern
        </button>
      </div>
      <StatusMessage status={status} />
    </section>
  );
}
