/**
 * Farbthema-Auswahl (Club / Nacht / Sand), platziert unter der Sprachwahl.
 */
import { useState, type JSX } from "react";
import { useI18n } from "./I18nProvider.js";
import { THEMES, applyTheme, getStoredTheme } from "./theme.js";

export function ThemeSwitch(): JSX.Element {
  const { t } = useI18n();
  const [active, setActive] = useState<string>(() => getStoredTheme());

  const choose = (id: string): void => {
    applyTheme(id);
    setActive(id);
  };

  return (
    <div className="theme-switch" role="group" aria-label={t("theme.label")}>
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className="theme-switch__btn"
          aria-pressed={theme.id === active}
          aria-label={t(theme.labelKey)}
          title={t(theme.labelKey)}
          onClick={() => choose(theme.id)}
        >
          <span className="theme-switch__dot" style={{ background: theme.dot }} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
