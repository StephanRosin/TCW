import { useCallback, useState, type JSX } from "react";

export interface StatusInfo {
  text: string;
  isError: boolean;
}

export function useStatus(): {
  status: StatusInfo | null;
  showOk: (text: string) => void;
  showError: (text: string) => void;
  clear: () => void;
} {
  const [status, setStatus] = useState<StatusInfo | null>(null);
  return {
    status,
    showOk: useCallback((text: string) => setStatus({ text, isError: false }), []),
    showError: useCallback((text: string) => setStatus({ text, isError: true }), []),
    clear: useCallback(() => setStatus(null), []),
  };
}

export function StatusMessage({ status }: { status: StatusInfo | null }): JSX.Element | null {
  if (!status) {
    return null;
  }
  return <div className={`msg ${status.isError ? "msg--err" : "msg--ok"}`}>{status.text}</div>;
}
