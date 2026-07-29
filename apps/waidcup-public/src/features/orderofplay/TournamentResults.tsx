/**
 * Abschluss-Übersicht: tritt an die Stelle des Spielplans, sobald alle Partien
 * gespielt sind – ein leeres Platzraster hilft dann niemandem mehr.
 *
 * Je Konkurrenz eine Zeile mit Sieger und Runner-up. Statt Textmarken stehen
 * dort Pokale (Gold gross, Silber kleiner); die passende Beschriftung bleibt
 * als Vorlesetext erhalten, sonst ginge für Screenreader die Bedeutung
 * verloren. Alle Zeilen sind gleich hoch, damit die Tafel ruhig wirkt.
 */
import type { JSX } from "react";
import type { WaidcupEventResult } from "@tcw/shared";
import { championLabelKey, PlayerLink, useI18n } from "@tcw/tournament-ui";

/** Pokal in Metallfarben – bewusst themeunabhängig, Gold bleibt Gold. */
function Trophy({ place }: Readonly<{ place: "gold" | "silver" }>): JSX.Element {
  const body = place === "gold" ? "#e8b923" : "#c6ccd4";
  const shade = place === "gold" ? "#bd8a14" : "#8f98a3";
  return (
    <svg className={`wc-trophy wc-trophy--${place}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {/* Henkel */}
      <path
        d="M6.5 4.5H3.2v2.1A4.3 4.3 0 0 0 7.2 11M17.5 4.5h3.3v2.1A4.3 4.3 0 0 1 16.8 11"
        fill="none"
        stroke={shade}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* Kelch */}
      <path d="M5.8 2.4h12.4v5.4a6.2 6.2 0 0 1-12.4 0V2.4z" fill={body} />
      {/* Glanzkante */}
      <path d="M8.1 3.6h2.1v4.2a2.1 2.1 0 0 0 .9 1.7" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.1" strokeLinecap="round" />
      {/* Stiel, Fuss, Sockel */}
      <path d="M10.9 13.8h2.2v2.9h-2.2z" fill={shade} />
      <path d="M9.2 16.7h5.6l1.1 2.6H8.1z" fill={body} />
      <rect x="7.2" y="19.3" width="9.6" height="2.3" rx="0.6" fill={shade} />
    </svg>
  );
}

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
              <Trophy place="gold" />
              <span className="wc-results__sr">{t(championLabelKey(event.discipline))}</span>
              <Names names={event.winnerNames} playerUrls={playerUrls} />
            </div>
            {event.runnerUpNames.length > 0 ? (
              <div className="wc-results__row wc-results__row--runner">
                <Trophy place="silver" />
                <span className="wc-results__sr">{t("results.runnerUp")}</span>
                <Names names={event.runnerUpNames} playerUrls={playerUrls} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
