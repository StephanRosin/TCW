/**
 * Fußbereich mit Impressum.
 */
import type { JSX } from "react";
import { useI18n } from "../i18n/I18nProvider.js";

export function SiteFooter(): JSX.Element {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>{t("footer.imprint")}</span>
        <span>{t("app.title")}</span>
      </div>
    </footer>
  );
}
