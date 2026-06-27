/**
 * Kapselt das wiederkehrende Mutations-Muster im Admin: Busy-Zustand,
 * Erfolg-/Fehlermeldung und optionales Neuladen nach Erfolg.
 */
import { useCallback, useState } from "react";
import { toErrorMessage } from "@tcw/shared";
import { useStatus, type StatusInfo } from "./components/Status.js";

export interface Mutation {
  status: StatusInfo | null;
  busy: boolean;
  run: (action: () => Promise<unknown>, successMessage: string) => Promise<void>;
  /** Zeigt eine Fehlermeldung ohne Aktion (z. B. clientseitige Validierung). */
  fail: (message: string) => void;
}

export function useMutation(onSuccess?: () => void): Mutation {
  const { status, showOk, showError } = useStatus();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setBusy(true);
      try {
        await action();
        showOk(successMessage);
        onSuccess?.();
      } catch (error) {
        showError(toErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [onSuccess, showOk, showError],
  );

  return { status, busy, run, fail: showError };
}
