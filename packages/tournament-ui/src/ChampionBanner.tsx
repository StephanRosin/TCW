/**
 * Sieger-Banner über einem Tableau oder einer Round-robin-Tabelle.
 *
 * Breite Tableaus (ab 1/32-Final) und schmale Viewports scrollen horizontal;
 * die Sieger-Spalte liegt dann ausserhalb des Sichtbereichs und der
 * Scrollbalken am Fuss eines sehr hohen Baums. Der Banner zeigt das Ergebnis
 * deshalb ohne Scrollen. Die Beschriftung ist je Disziplin geschlechtergerecht.
 */
import type { JSX } from "react";
import type { Discipline } from "@tcw/shared";
import { championLabelKey } from "./champion.js";
import { useI18n } from "./I18nProvider.js";
import { PlayerLink } from "./PlayerLink.js";

export function ChampionBanner({
  names,
  discipline,
  playerUrls,
}: Readonly<{
  names: string[];
  discipline?: Discipline | "";
  playerUrls?: Record<string, string>;
}>): JSX.Element | null {
  const { t } = useI18n();
  if (names.length === 0) return null;
  return (
    <div className="tbracket-champion-banner">
      <span className="tbracket-champion-banner__label">{t(championLabelKey(discipline))}</span>
      <span className="tbracket-champion-banner__names">
        {names.map((name) => (
          <PlayerLink key={name} name={name} playerUrls={playerUrls} />
        ))}
      </span>
    </div>
  );
}
