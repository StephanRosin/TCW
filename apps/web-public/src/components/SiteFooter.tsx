/**
 * Fußbereich: Impressum links, Layout-Schalter mittig, Datenstand rechts.
 * Der Schalter sitzt in beiden Layouts an derselben Stelle, damit er beim
 * Umschalten nicht springt.
 */
import type { JSX, ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider.js";

export function SiteFooter({ stand, extraControl }: Readonly<{ stand: string; extraControl?: ReactNode }>): JSX.Element {
  const { t } = useI18n();
  const standLabel = stand ? t("app.stand", { value: stand }) : t("app.defaultStand");
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span className="site-footer__side">
          <a href="#impressum" style={{ color: "inherit", textDecoration: "none" }}>
            {t("footer.imprint")}
          </a>
        </span>
        {extraControl}
        <span className="stand-badge site-footer__side site-footer__side--right">{standLabel}</span>
      </div>
    </footer>
  );
}
