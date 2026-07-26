/**
 * Grossbild-Ansicht der Galerie: modaler Dialog mit Blättern per Pfeiltasten,
 * Schaltflächen und Wischgeste, ESC zum Schliessen. Geblättert wird innerhalb
 * der aktuell gefilterten Auswahl. Während der Dialog offen ist, scrollt die
 * Seite dahinter nicht mit.
 */
import { useEffect, useRef, type JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";
import { formatGalleryDay } from "./galleryDate.js";
import type { GalleryPhoto } from "./photos.js";

/** Ab dieser horizontalen Strecke gilt eine Berührung als Wischgeste. */
const SWIPE_PX = 50;

export function Lightbox({
  photos,
  index,
  onClose,
  onStep,
}: Readonly<{
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  /** Blättert relativ (-1/+1); der Aufrufer rechnet gegen den aktuellen Stand. */
  onStep: (delta: number) => void;
}>): JSX.Element | null {
  const { t, language } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const photo = photos[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onStep(-1);
      else if (event.key === "ArrowRight") onStep(1);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  });

  if (!photo) return null;

  const onTouchEnd = (endX: number): void => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null) return;
    const distance = endX - startX;
    if (Math.abs(distance) >= SWIPE_PX) onStep(distance < 0 ? 1 : -1);
  };

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t("gallery.title")}
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      <button ref={closeRef} type="button" className="lightbox__close" aria-label={t("gallery.close")} onClick={onClose}>
        ✕
      </button>
      {photos.length > 1 ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--prev"
          aria-label={t("gallery.previous")}
          onClick={(event) => {
            event.stopPropagation();
            onStep(-1);
          }}
        >
          ‹
        </button>
      ) : null}
      {/* Klicks auf das Bild selbst dürfen den Dialog nicht schliessen. */}
      <figure className="lightbox__figure" onClick={(event) => event.stopPropagation()}>
        <img className="lightbox__image" src={photo.large} alt="" />
        <figcaption className="lightbox__caption">
          <span>{formatGalleryDay(photo.day, language)}</span>
          <span className="lightbox__counter">
            {t("gallery.counter", { number: index + 1, total: photos.length })}
          </span>
        </figcaption>
      </figure>
      {photos.length > 1 ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--next"
          aria-label={t("gallery.next")}
          onClick={(event) => {
            event.stopPropagation();
            onStep(1);
          }}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}
