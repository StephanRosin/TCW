/**
 * Aktionen/Importe: Klassierungen aktualisieren (MyTennis) und Spieltermine
 * importieren (ClubResult). Die Klassierungs-Aktualisierung läuft als
 * Hintergrund-Job (~48 Min über alle Kandidaten) und wird per Polling
 * verfolgt statt die Anfrage zu blockieren.
 */
import { useEffect, useState, type JSX } from "react";
import { toErrorMessage } from "@tcw/shared";
import { adminApi } from "../api/adminClient.js";
import type { KlassierungStatus } from "../api/adminClient.js";
import { StatusMessage, useStatus } from "../components/Status.js";

const POLL_INTERVAL_MS = 3000;

export function ActionsAdmin(): JSX.Element {
  const { status, showOk, showError } = useStatus();
  const [busy, setBusy] = useState<"" | "ranking" | "matches">("");
  const [klJob, setKlJob] = useState<KlassierungStatus | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (!polling) {
      return;
    }
    const id = setInterval(() => {
      adminApi
        .klassierungStatus()
        .then((current) => {
          setKlJob(current);
          if (!current.running) {
            setPolling(false);
            setBusy("");
            if (current.error) {
              showError(current.error);
            } else {
              showOk(
                `Klassierungen aktualisiert. Aktualisiert: ${current.updated}, Unverändert: ${current.unchanged}, Übersprungen: ${current.skipped}.`,
              );
            }
          }
        })
        .catch((caught: unknown) => {
          showError(toErrorMessage(caught));
          setPolling(false);
          setBusy("");
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [polling, showOk, showError]);

  const updateRanking = async (): Promise<void> => {
    try {
      const result = await adminApi.startKlassierungUpdate();
      if (result.alreadyRunning) {
        showError("Eine Aktualisierung läuft bereits.");
      }
      setBusy("ranking");
      setPolling(true);
    } catch (caught) {
      showError(toErrorMessage(caught));
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

  const progressPercent = klJob && klJob.total > 0 ? Math.round((klJob.processed / klJob.total) * 100) : 0;

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
      {busy === "ranking" && klJob?.running ? (
        <div>
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={klJob.processed}
            aria-valuemin={0}
            aria-valuemax={klJob.total}
          >
            <div className="progress__bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="hint">
            {klJob.processed}/{klJob.total} ({progressPercent}%)
          </p>
        </div>
      ) : null}
      <StatusMessage status={status} />
    </div>
  );
}
