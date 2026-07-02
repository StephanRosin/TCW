/**
 * Mehrsprachigkeit der öffentlichen Seite (DE/EN/FR).
 *
 * Lädt die Übersetzungsressourcen als JSON, merkt die Sprache im Local Storage
 * und aktualisiert die UI ohne Full Page Reload. Bietet `t` (Schlüssel →
 * Text mit Interpolation) und `translateKnown` (kontextuelle Begriffe in Daten).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  translateKnownText,
  type Language,
} from "@tcw/shared";

type Translations = Record<string, string>;

interface I18nContextValue {
  language: Language;
  t: (key: string, params?: Record<string, string | number>) => string;
  translateKnown: (value: string) => string;
  setLanguage: (language: Language) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(value: string | null | undefined): Language | null {
  const candidate = (value ?? "").slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(candidate as Language) ? (candidate as Language) : null;
}

function detectInitialLanguage(): Language {
  const stored = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  if (stored) return stored;
  for (const candidate of [navigator.language, ...(navigator.languages ?? [])]) {
    const detected = normalizeLanguage(candidate);
    if (detected) return detected;
  }
  return DEFAULT_LANGUAGE;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}

async function loadTranslations(language: Language): Promise<Translations> {
  const response = await fetch(`/i18n/${language}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Übersetzungen für "${language}" konnten nicht geladen werden.`);
  }
  return (await response.json()) as Translations;
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element | null {
  const [language, setLanguageState] = useState<Language>(() => detectInitialLanguage());
  const [translations, setTranslations] = useState<Translations | null>(null);

  useEffect(() => {
    let active = true;
    loadTranslations(language)
      .then((loaded) => {
        if (active) {
          setTranslations(loaded);
          document.documentElement.lang = language;
        }
      })
      .catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    setLanguageState(next);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, params?: Record<string, string | number>): string =>
      interpolate(translations?.[key] ?? key, params);
    return {
      language,
      t,
      translateKnown: (raw: string) => translateKnownText(raw, (key) => t(key)),
      setLanguage,
    };
  }, [language, translations, setLanguage]);

  if (!translations) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n muss innerhalb von <I18nProvider> verwendet werden.");
  }
  return context;
}
