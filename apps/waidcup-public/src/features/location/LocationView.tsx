/**
 * Standort- und Willkommensseite des Waidcups: Begrüssung mit langsam
 * überblendendem Anlagenfoto (Wechsel alle 10 s), Anfahrtsinformationen
 * (ÖV empfohlen, Parkkarte zum Download) und eine eingebettete Google-Maps-Karte.
 */
import { useEffect, useState, type JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";

// Einbettung ohne API-Key über den offiziellen ?output=embed-Modus.
const MAPS_EMBED_URL =
  "https://www.google.com/maps?q=Tennisclub%20Waidberg%2C%20Waidbadstrasse%20151%2C%208037%20Z%C3%BCrich&z=16&output=embed";

const HERO_IMAGES = [
  { src: "/anlage-1.jpg", altKey: "location.photoAlt1" },
  { src: "/anlage-2.jpg", altKey: "location.photoAlt2" },
] as const;
const HERO_INTERVAL_MS = 10_000;

export function LocationView(): JSX.Element {
  const { t } = useI18n();
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((index) => (index + 1) % HERO_IMAGES.length);
    }, HERO_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="loc">
      <div className="loc__hero">
        {HERO_IMAGES.map((image, index) => (
          <img
            key={image.src}
            className="loc__hero-img"
            src={image.src}
            alt={t(image.altKey)}
            aria-hidden={index === heroIndex ? undefined : true}
            style={{ opacity: index === heroIndex ? 1 : 0 }}
          />
        ))}
        <div className="loc__hero-overlay">
          <h2 className="loc__title">{t("location.welcomeTitle")}</h2>
          <p className="loc__lead">{t("location.welcomeText")}</p>
        </div>
      </div>

      <div className="loc__row">
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
    </section>
  );
}
