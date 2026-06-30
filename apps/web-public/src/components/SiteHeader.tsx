/**
 * Kopfbereich mit Logo, Titel, Importstand und Sprachwahl.
 */
import type { JSX } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { LanguageSwitch } from "./LanguageSwitch.js";
import { ThemeSwitch } from "./ThemeSwitch.js";

export function SiteHeader({ stand }: { stand: string }): JSX.Element {
  const { t } = useI18n();
  const standLabel = stand ? t("app.stand", { value: stand }) : t("app.defaultStand");

  return (
    <header className="site-header">
      <div className="container">
        <div className="site-header__top">
          <div className="brand">
            <img className="brand__logo" src="/logo-tcw.png" alt="TC Waidberg" />
            <div>
              <div className="brand__eyebrow">TC Waidberg</div>
              <div className="brand__title">{t("app.title")}</div>
            </div>
          </div>
          <div className="site-header__controls">
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
        <div className="site-header__meta">
          <span className="stand-badge">{standLabel}</span>
        </div>
      </div>
    </header>
  );
}
