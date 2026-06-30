/**
 * Plätze: links das Webcam-Bild (Klick öffnet es im Vollbild – dasselbe Modal
 * wie die Teamfotos), rechts die Live-Platzbelegung (GotCourts) eingebettet.
 * Das Webcam-Standbild wird alle 10 Sekunden frisch geladen.
 */
import { useEffect, useState, type JSX } from "react";
import { useI18n } from "../../i18n/I18nProvider.js";
import { TeamPhotoModal } from "../teams/TeamPhotoModal.js";

const WEBCAM_URL = "http://tcwaidberg.no-ip.org:10554/streaming/channels/2/picture";
const OCCUPANCY_URL = "https://apps.gotcourts.com/en/terminal/tv/673a6";
const REFRESH_MS = 10_000;

/** Hängt einen Zeitstempel an, damit der Browser ein frisches Standbild lädt. */
function webcamSrc(tick: number): string {
  return `${WEBCAM_URL}?t=${tick}`;
}

export function PlaetzeView(): JSX.Element {
  const { t } = useI18n();
  const [tick, setTick] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [modalSrc, setModalSrc] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="plaetze">
      <div className="plaetze__grid">
        <figure className="plaetze__cam">
          <figcaption className="plaetze__caption">{t("plaetze.webcam")}</figcaption>
          {failed ? (
            <div className="plaetze__cam-error state">{t("plaetze.webcamError")}</div>
          ) : (
            <button
              type="button"
              className="plaetze__cam-btn"
              onClick={() => setModalSrc(webcamSrc(Date.now()))}
              aria-label={t("plaetze.webcamOpen")}
            >
              <img
                className="plaetze__cam-img"
                src={webcamSrc(tick)}
                alt={t("plaetze.webcam")}
                onError={() => setFailed(true)}
              />
              <span className="plaetze__cam-hint">{t("plaetze.webcamOpen")}</span>
            </button>
          )}
        </figure>

        <div className="plaetze__occupancy">
          <div className="plaetze__caption">{t("plaetze.occupancy")}</div>
          <iframe
            className="plaetze__frame"
            src={OCCUPANCY_URL}
            title={t("plaetze.occupancy")}
            loading="lazy"
          />
        </div>
      </div>

      {modalSrc ? (
        <TeamPhotoModal src={modalSrc} title={t("plaetze.webcam")} onClose={() => setModalSrc(null)} />
      ) : null}
    </section>
  );
}
