/**
 * Turnierbaum-Seite: Kategorie-Chips (gleiche Struktur und Reihenfolge wie
 * bei den Matches) und das Tableau des gewählten Events. Vor der Auslosung
 * erscheint ein klarer Hinweis.
 */
import { useMemo, useState, type JSX } from "react";
import type { TournamentEventView, TournamentMatch } from "@tcw/shared";
import { MatchList, ResourceView, TournamentBracket, useI18n, useResource } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";
import { compareWaidcupEvents } from "../../lib/events.js";
import { SWISSTENNIS_TOURNAMENT_URL } from "../../lib/links.js";
import { PoolStandings } from "./PoolStandings.js";

/** Ab wie vielen Zeichen die Namenssuche im Tableau markiert. */
const MIN_SEARCH_LENGTH = 3;

/** Ein Event ist darstellbar, wenn es ein Tableau (Draw) oder Pools (Round-robin)
 *  hat. So verschwinden abgesagte/leere Konkurrenzen automatisch. */
function hasContent(event: TournamentEventView): boolean {
  return event.bracket !== null || event.pools.length > 0;
}

/** Nur Partien mit beiden Seiten besetzt (keine „Sieger aus …"-Platzhalter). */
function playableMatches(event: TournamentEventView): TournamentMatch[] {
  return event.matches.filter((match) => match.side1Names.length > 0 && match.side2Names.length > 0);
}

function BracketsPanel({
  events,
  playerUrls,
}: Readonly<{ events: TournamentEventView[]; playerUrls: Record<string, string> }>): JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(
    () => events.filter(hasContent).sort((a, b) => compareWaidcupEvents(a.eventName, b.eventName)),
    [events],
  );
  const [activeEventId, setActiveEventId] = useState<number>(sorted[0]?.eventId ?? 0);
  const [search, setSearch] = useState("");
  const active = sorted.find((event) => event.eventId === activeEventId) ?? sorted[0];
  // Partienliste nur bei Round-robin (Pool) – dort gibt es keinen Baum. Bei
  // Tableaux stehen Termin/Platz direkt im Baum (und die volle Liste im Matches-Tab).
  const poolMatches = active && active.pools.length > 0 ? playableMatches(active) : [];
  // Markieren erst ab MIN_SEARCH_LENGTH Zeichen.
  const activeSearch = search.trim().length >= MIN_SEARCH_LENGTH ? search : "";

  if (sorted.length === 0) {
    return <div className="state">{t("brackets.empty")}</div>;
  }

  return (
    <>
      <div className="subtabs-row">
        <div className="subtabs" role="tablist">
          {sorted.map((event) => (
            <button
              key={event.eventId}
              type="button"
              role="tab"
              className="chip"
              aria-selected={event.eventId === activeEventId}
              onClick={() => setActiveEventId(event.eventId)}
            >
              {event.eventName}
            </button>
          ))}
        </div>
        <div className="subtabs-row__right">
          <input
            type="search"
            className="pm-input st-search"
            placeholder={t("tournaments.playerSearchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("tournaments.playerSearchPlaceholder")}
          />
          <a className="st-link" href={SWISSTENNIS_TOURNAMENT_URL} target="_blank" rel="noopener noreferrer">
            {t("tournaments.swisstennisLink")} ↗
          </a>
        </div>
      </div>
      {active?.bracket ? (
        <TournamentBracket bracket={active.bracket} search={activeSearch} playerUrls={playerUrls} />
      ) : active && active.pools.length > 0 ? (
        <PoolStandings pools={active.pools} search={activeSearch} playerUrls={playerUrls} />
      ) : (
        <div className="state">{t("brackets.noBracket")}</div>
      )}
      {poolMatches.length > 0 ? (
        <div className="wc-event-matches">
          <h4 className="wc-event-matches__title">{t("brackets.matchesTitle")}</h4>
          <MatchList matches={poolMatches} order="upcomingFirst" playerUrls={playerUrls} />
        </div>
      ) : null}
    </>
  );
}

export function BracketsView(): JSX.Element {
  const state = useResource(() => waidcupApi.brackets(), []);
  return (
    <section>
      <ResourceView state={state} errorKey="brackets.loadError">
        {(data) => <BracketsPanel events={data.events} playerUrls={data.playerUrls} />}
      </ResourceView>
    </section>
  );
}
