/**
 * Fußbereich mit Impressum.
 */
import type { JSX } from "react";
import { useI18n } from "../i18n/I18nProvider.js";

export function SiteFooter({ stand }: { stand: string }): JSX.Element {
  const { t } = useI18n();
  const standLabel = stand ? t("app.stand", { value: stand }) : t("app.defaultStand");
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>{t("footer.imprint")}</span>
        <span className="stand-badge">{standLabel}</span>
        <span>{t("app.title")}</span>
      </div>
    </footer>
  );
}
