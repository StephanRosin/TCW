/**
 * Lädt asynchrone Daten und stellt einen `reload` zum Neuladen bereit.
 */
import { useCallback, useEffect, useState } from "react";

export interface AsyncState<TData> {
  data: TData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<TData>(loader: () => Promise<TData>): AsyncState<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { data, loading, error, reload };
}
