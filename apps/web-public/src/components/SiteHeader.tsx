/**
 * Kopfbereich mit Logo, Titel, Helfereinsatz-Aktion sowie Sprach- und
 * Themenwahl.
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
            <a
              className="header-cta"
              href="https://tcwaidberg.ch/helfereinsatz"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("nav.helfereinsatz")} <span aria-hidden="true">↗</span>
            </a>
            <div className="site-header__switches">
              <LanguageSwitch />
              <ThemeSwitch />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
