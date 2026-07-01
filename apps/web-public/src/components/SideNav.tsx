/**
 * Redesign-Prototyp „Night Court": vertikale Seitennavigation.
 * Desktop: feste Leiste links (Brand oben, Navigation, Aktionen unten).
 * Mobil: zusammengeklappt als Kopfzeile mit horizontal scrollender Navigation.
 */
import type { JSX } from "react";
import { type MainView, type NavItem } from "../app/navigation.js";
import { useI18n } from "../i18n/I18nProvider.js";
import { LanguageSwitch } from "./LanguageSwitch.js";
import { ThemeSwitch } from "./ThemeSwitch.js";

interface SideNavProps {
  items: ReadonlyArray<NavItem>;
  activeView: MainView;
  onSelect: (view: MainView) => void;
}

/** Minimalistische Linien-Icons (16×16, Strichstärke 1.7, currentColor). */
const ICONS: Record<string, JSX.Element> = {
  teams: (
    <>
      <circle cx="5.5" cy="6" r="2.3" />
      <circle cx="11" cy="6" r="2.3" />
      <path d="M1.8 13.5c0-2 1.7-3.4 3.7-3.4s3.7 1.4 3.7 3.4M8.6 10.6c.7-.3 1.5-.5 2.4-.5 2 0 3.7 1.4 3.7 3.4" />
    </>
  ),
  training: (
    <>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.5V8l2.4 1.6" />
    </>
  ),
  matches: (
    <>
      <rect x="2" y="3.2" width="12" height="10.8" rx="1.6" />
      <path d="M2 6.4h12M5.4 1.8v2.8M10.6 1.8v2.8" />
    </>
  ),
  results: (
    <>
      <path d="M4.5 2.2h7v3.6a3.5 3.5 0 0 1-7 0z" />
      <path d="M4.5 3.4H2.4a2.6 2.6 0 0 0 2.5 3M11.5 3.4h2.1a2.6 2.6 0 0 1-2.5 3M8 9.4v2.2M5.4 14h5.2M8 11.6V14" />
    </>
  ),
  "team-challenge": (
    <>
      <path d="M8 1.8 13.4 4v3.6c0 3.4-2.2 5.6-5.4 6.8-3.2-1.2-5.4-3.4-5.4-6.8V4z" />
    </>
  ),
  "player-matches": (
    <>
      <circle cx="6.5" cy="5.8" r="2.5" />
      <path d="M2.2 13.6c0-2.2 1.9-3.8 4.3-3.8 1 0 1.9.3 2.6.8" />
      <circle cx="11.6" cy="11.4" r="2.4" />
      <path d="m13.4 13.2 1.4 1.4" />
    </>
  ),
  ratings: (
    <>
      <path d="M2 13.5 6.2 9l2.6 2.4 5-5.6" />
      <path d="M10.5 5.8h3.3v3.3" />
    </>
  ),
  tournaments: (
    <>
      <path d="M2.2 3.4h4v3.4h-4zM2.2 9.2h4v3.4h-4zM9.8 6.3h4v3.4h-4z" />
      <path d="M6.2 5.1h1.8v5.8H6.2M8 8h1.8" />
    </>
  ),
  agenda: (
    <>
      <path d="M3 3h10M3 6.4h10M3 9.8h6.5M3 13.2h4" />
    </>
  ),
  plaetze: (
    <>
      <rect x="1.8" y="3" width="12.4" height="10" rx="1.2" />
      <path d="M8 3v10M1.8 5.6h2.6v4.8H1.8M14.2 5.6h-2.6v4.8h2.6" />
    </>
  ),
};

export function SideNav({ items, activeView, onSelect }: SideNavProps): JSX.Element {
  const { t } = useI18n();
  return (
    <aside className="sidenav">
      <div className="sidenav__brand">
        <img className="sidenav__logo" src="/logo-tcw.png" alt="TC Waidberg" />
        <div>
          <div className="sidenav__eyebrow">TC Waidberg</div>
          <div className="sidenav__title">{t("app.title")}</div>
        </div>
      </div>

      <nav className="sidenav__nav" role="tablist" aria-label={t("nav.sections")}>
        {items.map((item) => (
          <button
            key={item.view}
            type="button"
            role="tab"
            className="sidenav__item"
            aria-selected={item.view === activeView}
            onClick={() => onSelect(item.view)}
          >
            <svg
              className="sidenav__icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[item.view] ?? <circle cx="8" cy="8" r="5.5" />}
            </svg>
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>

      <div className="sidenav__foot">
        <a
          className="sidenav__cta"
          href="https://tcwaidberg.ch/helfereinsatz"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("nav.helfereinsatz")} <span aria-hidden="true">↗</span>
        </a>
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </aside>
  );
}
