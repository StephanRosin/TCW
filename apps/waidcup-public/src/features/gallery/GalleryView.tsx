/**
 * Fotogalerie des Waidcups: Kachelraster je Jahrgang mit Tagesfilter und
 * Lightbox. Die Bilder kommen als Jahr/Tag-Struktur vom Server; ein neuer
 * Jahrgang erscheint automatisch, sobald sein Ordner hochgeladen ist.
 *
 * Geladen werden nur die kleinen Kacheln (nativ lazy), das Grossbild erst beim
 * Öffnen der Lightbox – so bleibt auch ein Tag mit ~100 Bildern leichtgewichtig.
 */
import { useMemo, useState, type JSX } from "react";
import { ResourceView, useI18n, useResource } from "@tcw/tournament-ui";
import type { WaidcupGalleryResponse, WaidcupGalleryYear } from "@tcw/shared";
import { waidcupApi } from "../../api/client.js";
import { formatGalleryDay } from "./galleryDate.js";
import { Lightbox } from "./Lightbox.js";
import { photosOf } from "./photos.js";

function FilterChip({
  label,
  count,
  active,
  onClick,
}: Readonly<{ label: string; count: number; active: boolean; onClick: () => void }>): JSX.Element {
  return (
    <button type="button" className={active ? "chip is-active" : "chip"} aria-pressed={active} onClick={onClick}>
      {label} ({count})
    </button>
  );
}

function YearGallery({ year }: Readonly<{ year: WaidcupGalleryYear }>): JSX.Element {
  const { t, language } = useI18n();
  const [day, setDay] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const photos = useMemo(() => photosOf(year, day), [year, day]);
  const total = useMemo(() => year.days.reduce((sum, entry) => sum + entry.images.length, 0), [year]);

  const selectDay = (next: string | null): void => {
    setDay(next);
    setOpenIndex(null); // Auswahl wechselt → offener Index passt nicht mehr
  };

  return (
    <>
      <div className="tournament-filterbar gallery__filters">
        <FilterChip label={t("gallery.all")} count={total} active={day === null} onClick={() => selectDay(null)} />
        {year.days.map((entry) => (
          <FilterChip
            key={entry.day}
            label={formatGalleryDay(entry.day, language)}
            count={entry.images.length}
            active={day === entry.day}
            onClick={() => selectDay(entry.day)}
          />
        ))}
      </div>

      {/* key erzwingt beim Filterwechsel ein neues Raster – damit läuft die
          Einblend-Animation der Kacheln erneut. */}
      <div className="gallery__grid" key={day ?? "all"}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className="gallery__tile"
            style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
            aria-label={t("gallery.open", { number: index + 1, total: photos.length })}
            onClick={() => setOpenIndex(index)}
          >
            <img className="gallery__image" src={photo.thumb} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          // Relativ und funktional gerechnet: mehrere Tastendrücke im selben
          // Render-Durchlauf zählen dadurch einzeln.
          onStep={(delta) =>
            setOpenIndex((current) =>
              current === null ? current : (current + delta + photos.length) % photos.length,
            )
          }
        />
      ) : null}
    </>
  );
}

function GalleryContent({ data }: Readonly<{ data: WaidcupGalleryResponse }>): JSX.Element {
  const { t } = useI18n();
  const [yearIndex, setYearIndex] = useState(0);
  const year = data.years[yearIndex];

  if (!year) return <div className="state">{t("gallery.empty")}</div>;

  return (
    <section className="gallery">
      <h2 className="section-title">{t("gallery.title")}</h2>
      {/* Jahresauswahl erst sinnvoll, sobald es mehrere Jahrgänge gibt. */}
      {data.years.length > 1 ? (
        <div className="tournament-filterbar gallery__years">
          {data.years.map((entry, index) => (
            <button
              key={entry.year}
              type="button"
              className={index === yearIndex ? "chip is-active" : "chip"}
              aria-pressed={index === yearIndex}
              onClick={() => setYearIndex(index)}
            >
              {entry.year}
            </button>
          ))}
        </div>
      ) : null}
      <YearGallery key={year.year} year={year} />
    </section>
  );
}

export function GalleryView(): JSX.Element {
  const state = useResource(() => waidcupApi.gallery(), []);
  return (
    <ResourceView state={state} errorKey="gallery.error">
      {(data) => <GalleryContent data={data} />}
    </ResourceView>
  );
}
