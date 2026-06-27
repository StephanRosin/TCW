/**
 * Lädt eine Ressource und stellt Lade-, Fehler- und Datenzustand bereit.
 */
import { useEffect, useState } from "react";

export type ResourceState<TData> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: TData };

export function useResource<TData>(loader: () => Promise<TData>, deps: unknown[] = []): ResourceState<TData> {
  const [state, setState] = useState<ResourceState<TData>>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (active) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) });
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
