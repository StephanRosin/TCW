/**
 * Hash-basiertes Routing, damit direkte Links auf Tabs funktionieren und
 * Navigation ohne Full Page Reload erfolgt.
 */
import { useCallback, useEffect, useState } from "react";

export function useHashRoute(): { hash: string; navigate: (hash: string) => void } {
  const [hash, setHash] = useState<string>(() => window.location.hash);

  useEffect(() => {
    const onHashChange = (): void => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: string) => {
    const normalized = next.startsWith("#") ? next : `#${next}`;
    if (window.location.hash !== normalized) {
      window.location.hash = normalized;
    }
  }, []);

  return { hash, navigate };
}
