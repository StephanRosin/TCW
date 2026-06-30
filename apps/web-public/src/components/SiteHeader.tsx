/**
 * Kopfbereich mit Logo, Titel, Importstand und Sprachwahl.
 */
import type { JSX } from "react";
import { useI18n } from "../i18n/I18nProvider.js";
import { LanguageSwitch } from "./LanguageSwitch.js";
import { ThemeSwitch } from "./ThemeSwitch.js";

export function SiteHeader(): JSX.Element {
  const { t } = useI18n();

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
      </div>
    </header>
  );
}
