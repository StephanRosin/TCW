/**
 * Sprachwahl mit Flaggen für Deutsch, Englisch und Französisch.
 */
import type { JSX } from "react";
import { SUPPORTED_LANGUAGES, type Language } from "@tcw/shared";
import { useI18n } from "../i18n/I18nProvider.js";

const FLAGS: Record<Language, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
};

export function LanguageSwitch(): JSX.Element {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t("footer.language")}>
      {SUPPORTED_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-switch__btn"
          aria-pressed={code === language}
          onClick={() => setLanguage(code)}
        >
          <span className="lang-switch__flag" aria-hidden="true">
            {FLAGS[code]}
          </span>
          {t(`language.${code}`)}
        </button>
      ))}
    </div>
  );
}
