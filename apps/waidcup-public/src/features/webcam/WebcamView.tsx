/**
 * Webcam-Seite: zeigt das Live-Standbild der Anlage, alle 10 s aktualisiert.
 * Das Bild kommt same-origin vom Server (gemeinsamer Cache, siehe
 * webcam-cache.ts) – kein Kamera-Abruf pro Client.
 */
import { useEffect, useState, type JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";

const WEBCAM_URL = "/api/webcam";
const REFRESH_MS = 10_000;

/** Zeitstempel anhängen, damit der Browser ein frisches Standbild lädt. */
function webcamSrc(tick: number): string {
  return `${WEBCAM_URL}?t=${tick}`;
}

export function WebcamView(): JSX.Element {
  const { t } = useI18n();
  const [tick, setTick] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="webcam">
      <figure className="webcam__frame">
        {failed ? (
          <div className="webcam__error state">{t("webcam.error")}</div>
        ) : (
          <img
            className="webcam__img"
            src={webcamSrc(tick)}
            alt={t("webcam.title")}
            onError={() => setFailed(true)}
            onLoad={() => setFailed(false)}
          />
        )}
        <p className="webcam__hint">{t("webcam.hint")}</p>
      </figure>
    </section>
  );
}
