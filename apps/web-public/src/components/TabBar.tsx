/**
 * Hauptnavigation als sticky Tableiste (ohne Full Page Reload via Hash).
 */
import type { JSX } from "react";
import { type MainView, type NavItem } from "../app/navigation.js";
import { useI18n } from "../i18n/I18nProvider.js";

interface TabBarProps {
  items: ReadonlyArray<NavItem>;
  activeView: MainView;
  onSelect: (view: MainView) => void;
}

export function TabBar({ items, activeView, onSelect }: Readonly<TabBarProps>): JSX.Element {
  const { t } = useI18n();
  return (
    <nav className="tabbar" aria-label={t("nav.sections")}>
      <div className="container tabbar__inner" role="tablist">
        {items.map((item) => (
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
