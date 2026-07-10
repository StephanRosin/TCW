/**
 * Vollbild-Modal für ein Teamfoto. Das Bild wird so skaliert, dass es ohne
 * Scrollen vollständig sichtbar ist und das Seitenverhältnis erhalten bleibt
 * (kein Stretch) – unabhängig von Auflösung und Hoch-/Querformat.
 */
import { useEffect, type JSX } from "react";
import { useI18n } from "../../i18n/I18nProvider.js";

interface TeamPhotoModalProps {
  src: string;
  title: string;
  onClose: () => void;
}

export function TeamPhotoModal({ src, title, onClose }: TeamPhotoModalProps): JSX.Element {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="photo-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <button type="button" className="photo-modal__close" aria-label={t("common.back")} onClick={onClose}>
        ✕
      </button>
      <figure
        className="photo-modal__figure"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <img className="photo-modal__img" src={src} alt={title} />
        <figcaption className="photo-modal__caption">{title}</figcaption>
      </figure>
    </div>
  );
}
