/**
 * Abschluss-Übersicht: tritt an die Stelle des Spielplans, sobald alle Partien
 * gespielt sind – ein leeres Platzraster hilft dann niemandem mehr.
 *
 * Je Konkurrenz eine Zeile mit Sieger und Zweitplatziertem. Die Sieger-
 * Beschriftung folgt der Disziplin (Siegerin bei den Frauen, Sieger*in bei
 * Mixed); der Zweite heisst überall gleich „Runner-up" – wechselnde
 * Bezeichnungen machten die Tafel unruhig.
 */
import type { JSX } from "react";
import type { WaidcupEventResult } from "@tcw/shared";
import { championLabelKey, PlayerLink, useI18n } from "@tcw/tournament-ui";

function Names({
  names,
  playerUrls,
}: Readonly<{ names: string[]; playerUrls?: Record<string, string> }>): JSX.Element {
  return (
    <span className="wc-results__names">
      {names.map((name) => (
        <PlayerLink key={name} name={name} playerUrls={playerUrls} />
      ))}
    </span>
  );
}

export function TournamentResults({
  events,
  playerUrls,
  compact = false,
}: Readonly<{
  events: WaidcupEventResult[];
  playerUrls?: Record<string, string>;
  /** Kiosk: gedrängtere Darstellung ohne Seitentitel. */
  compact?: boolean;
}>): JSX.Element {
  const { t } = useI18n();
  return (
    <section className={compact ? "wc-results wc-results--compact" : "wc-results"}>
      <h2 className="wc-results__title">{t("results.heading")}</h2>
      <div className="wc-results__grid">
        {events.map((event) => (
          <div key={event.eventId} className="wc-results__card">
            <div className="wc-results__event">{event.eventName}</div>
            <div className="wc-results__row wc-results__row--winner">
              <span className="wc-results__label">{t(championLabelKey(event.discipline))}</span>
              <Names names={event.winnerNames} playerUrls={playerUrls} />
            </div>
            {event.runnerUpNames.length > 0 ? (
              <div className="wc-results__row">
                <span className="wc-results__label">{t("results.runnerUp")}</span>
                <Names names={event.runnerUpNames} playerUrls={playerUrls} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
