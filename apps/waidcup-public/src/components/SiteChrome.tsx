/**
 * Header, Tab-Navigation und Footer der Waidcup-Seite im Classic-Look der
 * Spielbetriebsseite (gleiche CSS-Klassen aus @tcw/shared/styles/app.css).
 */
import type { JSX } from "react";
import { LanguageSwitch, ThemeSwitch, useI18n } from "@tcw/tournament-ui";
import { NAV_ITEMS, type MainView } from "../app/navigation.js";

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
              className="waidcup-flyer"
              href="/waidcup-flyer-2026.pdf"
              target="_blank"
              rel="noopener noreferrer"
              title={t("app.flyer")}
            >
              <img src="/waidcup-logo.png" alt={t("app.flyer")} />
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

export function TabBar({
  activeView,
  onSelect,
}: {
  activeView: MainView;
  onSelect: (view: MainView) => void;
}): JSX.Element {
  const { t } = useI18n();
  return (
    <nav className="tabbar" aria-label={t("nav.sections")}>
      <div className="container tabbar__inner" role="tablist">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            type="button"
            role="tab"
            className="tabbar__btn"
            aria-selected={item.view === activeView}
            onClick={() => onSelect(item.view)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function SiteFooter(): JSX.Element {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <span className="site-footer__side">{t("footer.imprint")}</span>
        <span className="site-footer__side site-footer__side--right">{t("app.title")}</span>
      </div>
    </footer>
  );
}
