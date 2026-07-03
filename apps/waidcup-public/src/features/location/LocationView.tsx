/**
 * Standort- und Willkommensseite des Waidcups: Begrüssung, Bilder der Anlage,
 * Anfahrtsinformationen (ÖV empfohlen, Parkkarte zum Download) sowie eine
 * eingebettete Google-Maps-Karte mit Link zur Routenplanung.
 */
import type { JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";

// Einbettung ohne API-Key über den offiziellen ?output=embed-Modus.
const MAPS_EMBED_URL =
  "https://www.google.com/maps?q=Tennisclub%20Waidberg%2C%20Waidbadstrasse%20151%2C%208037%20Z%C3%BCrich&z=16&output=embed";

export function LocationView(): JSX.Element {
  const { t } = useI18n();
  return (
    <section className="loc">
      <div className="loc__hero">
        <img className="loc__hero-img" src="/anlage-1.jpg" alt={t("location.photoAlt1")} />
        <div className="loc__hero-overlay">
          <h2 className="loc__title">{t("location.welcomeTitle")}</h2>
          <p className="loc__lead">{t("location.welcomeText")}</p>
        </div>
      </div>

      <div className="loc__grid">
        <article className="loc__card">
          <h3 className="loc__card-title">🚋 {t("location.transitTitle")}</h3>
          <p>{t("location.transitText")}</p>
          <h3 className="loc__card-title loc__card-title--sub">🚗 {t("location.parkingTitle")}</h3>
          <p>{t("location.parkingText")}</p>
          <a className="loc__btn loc__btn--pdf" href="/parkkarte.pdf" target="_blank" rel="noopener noreferrer">
            ⬇ {t("location.parkingDownload")}
          </a>
        </article>
      </div>

      <div className="loc__map">
        <iframe
          className="loc__map-frame"
          src={MAPS_EMBED_URL}
          title={t("location.mapTitle")}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <div className="loc__gallery">
        <img src="/anlage-1.jpg" alt={t("location.photoAlt1")} loading="lazy" />
        <img src="/anlage-2.jpg" alt={t("location.photoAlt2")} loading="lazy" />
      </div>
    </section>
  );
}
