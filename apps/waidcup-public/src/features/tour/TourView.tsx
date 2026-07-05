/**
 * „3D Tour"-Tab: zeigt zuerst nur einen Start-Button (der 22-MB-Rundgang und der
 * Pointer-Lock sollen erst auf ausdrückliche Nutzergeste laden). Nach dem Start
 * läuft die 3D-App in einem iframe; useScreenDriver bespielt ihre vier Screens.
 */
import { useCallback, useRef, useState, type JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";
import { useScreenDriver } from "./screenDriver.js";

export function TourView(): JSX.Element {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const getWindow = useCallback(() => iframeRef.current?.contentWindow ?? null, []);
  useScreenDriver(getWindow, t, started && !failed);

  if (!started) {
    return (
      <section className="tour tour--intro">
        <h2 className="tour__title">{t("nav.tour")}</h2>
        <p className="tour__lead">{t("tour.startHint")}</p>
        <button type="button" className="tour__start" onClick={() => setStarted(true)}>
          {t("tour.start")}
        </button>
      </section>
    );
  }

  return (
    <section className="tour tour--running">
      {failed ? (
        <div className="tour__error">
          <p>{t("tour.loadError")}</p>
          <button type="button" className="tour__start" onClick={() => setFailed(false)}>
            {t("tour.start")}
          </button>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className="tour__frame"
          src="/tcw3d/index.html"
          title={t("nav.tour")}
          allow="pointer-lock; fullscreen"
          onError={() => setFailed(true)}
        />
      )}
    </section>
  );
}
