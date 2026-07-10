/**
 * Plätze: links das Webcam-Bild (Klick öffnet es im Vollbild – dasselbe Modal
 * wie die Teamfotos), rechts die Live-Platzbelegung aus GotCourts, selbst
 * gerendert. Das Webcam-Standbild wird alle 10 Sekunden frisch geladen.
 *
 * Ein optionaler `?at=`-Parameter (ISO, z. B. 2026-07-01T19:30) verschiebt den
 * Bezugszeitpunkt der Belegung – zum Testen; ohne ihn gilt „jetzt".
 */
import { useEffect, useState, type JSX } from "react";
import type { CourtBlock } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { TeamPhotoModal } from "../teams/TeamPhotoModal.js";

// Same-Origin-Proxy (siehe apps/public-server/src/routes/webcam.ts): umgeht
// CSP/Mixed-Content und verbirgt den internen Kamera-Host.
const WEBCAM_URL = "/api/webcam";
const REFRESH_MS = 10_000;

/** Hängt einen Zeitstempel an, damit der Browser ein frisches Standbild lädt. */
function webcamSrc(tick: number): string {
  return `${WEBCAM_URL}?t=${tick}`;
}

/** Optionaler Test-Zeitpunkt aus der URL (?at=YYYY-MM-DDTHH:MM). */
function testAt(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("at") ?? undefined;
}

function OccupancyBlock({ block }: Readonly<{ block: CourtBlock }>): JSX.Element {
  const { t } = useI18n();
  return (
    <div className={block.live ? "courts-block courts-block--live" : "courts-block"}>
      <div className="courts-block__head">
        <span className="courts-block__label">
          {block.live ? `🎾 ${t("plaetze.now")}` : t("plaetze.next")}
        </span>
        <span className="courts-block__time">{block.label}</span>
      </div>
      {block.bookings.length === 0 ? (
        <div className="courts-empty">{t("plaetze.noPlay")}</div>
      ) : (
        <ul className="courts-list">
          {block.bookings.map((booking) => (
            <li className="courts-row" key={`${booking.court}-${booking.from}`}>
              <span className="courts-row__court">{booking.court}</span>
              <span className="courts-row__who">{booking.who}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlaetzeView(): JSX.Element {
  const { t } = useI18n();
  const [tick, setTick] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const occupancy = useResource(() => publicApi.courts(testAt()), []);

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
          <div className="plaetze__courts">
            <ResourceView state={occupancy} errorKey="plaetze.occupancyError">
              {(data) =>
                !data.available ? (
                  <div className="state">{t("plaetze.occupancyUnavailable")}</div>
                ) : (
                  <>
                    {data.blocks.map((block) => (
                      <OccupancyBlock block={block} key={block.label} />
                    ))}
                  </>
                )
              }
            </ResourceView>
          </div>
        </div>
      </div>

      {modalSrc ? (
        <TeamPhotoModal src={modalSrc} title={t("plaetze.webcam")} onClose={() => setModalSrc(null)} />
      ) : null}
    </section>
  );
}
