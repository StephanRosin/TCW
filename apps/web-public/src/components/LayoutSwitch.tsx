/**
 * Umschalter zwischen klassischem Layout und Studio-Layout (Seitennavigation).
 * Gleiche Optik wie Sprach-/Themenwahl (Pill mit zwei Optionen).
 */
import type { JSX } from "react";
import { LAYOUTS, type LayoutMode } from "../app/layout.js";
import { useI18n } from "../i18n/I18nProvider.js";

interface LayoutSwitchProps {
  value: LayoutMode;
  onChange: (mode: LayoutMode) => void;
}

export function LayoutSwitch({ value, onChange }: LayoutSwitchProps): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="lang-switch layout-switch" role="group" aria-label={t("layout.label")}>
      {LAYOUTS.map((option) => (
        <button
          key={option.id}
          type="button"
          className="lang-switch__btn"
          aria-pressed={option.id === value}
          onClick={() => onChange(option.id)}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
