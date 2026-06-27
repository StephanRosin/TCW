/**
 * Aktionen/Importe: Klassierungen aktualisieren (MyTennis) und Spieltermine
 * importieren (ClubResult). Das Ergebnis zeigt nur echte Änderungen.
 */
import { useState, type JSX } from "react";
import { toErrorMessage } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import { StatusMessage, useStatus } from "../components/Status.js";

export function ActionsAdmin(): JSX.Element {
  const { status, showOk, showError } = useStatus();
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState<"" | "ranking" | "matches">("");

  const updateRanking = async (): Promise<void> => {
    setBusy("ranking");
    setOutput("");
    try {
      const result = await adminApi.updateKlassierung();
      setOutput(result.output);
      showOk("Klassierungen aktualisiert.");
    } catch (caught) {
      showError(toErrorMessage(caught));
    } finally {
      setBusy("");
    }
  };

  const importMatches = async (): Promise<void> => {
    setBusy("matches");
    try {
      const result = await adminApi.importMatches();
      showOk(`Spieltermine importiert: ${result.count} Einträge.`);
    } catch (caught) {
      showError(toErrorMessage(caught));
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <h2>Aktionen / Importe</h2>
      <p className="hint">Die Aktionen rufen Swisstennis bzw. MyTennis serverseitig auf und können einen Moment dauern.</p>
      <div className="toolbar">
        <button className="btn btn--primary" disabled={busy !== ""} onClick={updateRanking}>
          {busy === "ranking" ? "Aktualisiere…" : "Klassierungen aktualisieren"}
        </button>
        <button className="btn btn--primary" disabled={busy !== ""} onClick={importMatches}>
          {busy === "matches" ? "Importiere…" : "Spieltermine importieren"}
        </button>
      </div>
      <StatusMessage status={status} />
      {output ? <pre className="output">{output}</pre> : null}
    </div>
  );
}
