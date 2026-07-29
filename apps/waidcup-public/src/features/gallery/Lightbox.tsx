/**
 * Grossbild-Ansicht der Galerie als natives <dialog>: der Browser übernimmt
 * damit Fokusfalle, Hintergrund-Inertheit und das Schliessen per ESC. Ergänzt
 * um Blättern per Pfeiltasten, Schaltflächen und Wischgeste; geblättert wird
 * innerhalb der aktuell gefilterten Auswahl.
 *
 * Tastatur- und Touch-Listener hängen bewusst am Element (nicht als JSX-Props),
 * damit der Dialog selbst keine Maus-/Tastaturbehandlung als nicht-interaktives
 * Element trägt. Zum Schliessen per Klick daneben dient eine eigene Fläche.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photo = photos[index];

  // Einmalig modal öffnen; erneutes showModal() auf einem offenen Dialog wirft.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    let touchStartX: number | null = null;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "ArrowLeft") onStep(-1);
      else if (event.key === "ArrowRight") onStep(1);
    };
    const onTouchStart = (event: TouchEvent): void => {
      touchStartX = event.changedTouches[0]?.clientX ?? null;
    };
    const onTouchEnd = (event: TouchEvent): void => {
      const startX = touchStartX;
      touchStartX = null;
      if (startX === null) return;
      const distance = (event.changedTouches[0]?.clientX ?? startX) - startX;
      if (Math.abs(distance) >= SWIPE_PX) onStep(distance < 0 ? 1 : -1);
    };

    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("touchstart", onTouchStart, { passive: true });
    dialog.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      dialog.removeEventListener("touchstart", onTouchStart);
      dialog.removeEventListener("touchend", onTouchEnd);
    };
  });

  if (!photo) return null;

  return (
    <dialog ref={dialogRef} className="lightbox" aria-label={t("gallery.title")} onClose={onClose}>
      {/* Fläche hinter dem Bild: Klick daneben schliesst. */}
      <button type="button" className="lightbox__backdrop" aria-label={t("gallery.close")} onClick={onClose} />
      {/* Lädt die JPEG-Fassung des Bildes; die Originale liegen nicht auf dem Server. */}
      <a
        className="lightbox__download"
        href={photo.download}
        download={photo.downloadName}
        aria-label={t("gallery.download")}
        title={t("gallery.download")}
      >
        ⬇
      </a>
      <button type="button" className="lightbox__close" aria-label={t("gallery.close")} onClick={onClose}>
        ✕
      </button>
      {photos.length > 1 ? (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--prev"
          aria-label={t("gallery.previous")}
          onClick={() => onStep(-1)}
        >
          ‹
        </button>
      ) : null}
      <figure className="lightbox__figure">
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
          onClick={() => onStep(1)}
        >
          ›
        </button>
      ) : null}
    </dialog>
  );
}
