/**
 * Meldet, ob der Viewport „mobil" (≤ 720px) ist. Reagiert live auf Grössen-
 * änderungen via matchMedia. Erste Mobile-Erkennung des Waidcup-Frontends.
 */
import { useEffect, useState } from "react";

export const MOBILE_QUERY = "(max-width: 720px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent): void => setIsMobile(event.matches);
    media.addEventListener("change", onChange);
    setIsMobile(media.matches);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
