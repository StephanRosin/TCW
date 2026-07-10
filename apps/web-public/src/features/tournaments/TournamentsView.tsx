/**
 * Turniere: Turnierauswahl (mit Anmelde-/Swisstennis-Link in derselben Zeile),
 * Kategorien (Damen-/Herren-Zeile, DM in beiden) mit Spielersuche und – je nach
 * Status – Anmeldungsliste oder Liste der ausgelosten Partien.
 */
import { useMemo, useState, type JSX } from "react";
import {
  compareEvents,
  safeExternalUrl,
  type TournamentEventView,
  type TournamentView,
} from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { menEvents, otherEvents, womenEvents } from "./eventGrouping.js";
import { RegistrationTable } from "./RegistrationTable.js";
import { MatchList } from "./MatchList.js";
import { PoolStandings } from "./PoolStandings.js";
import { TournamentBracket } from "./TournamentBracket.js";

const ALL_EVENTS = "";

function CategoryRow({
  labelKey,
  events,
  activeEventId,
  onSelect,
}: Readonly<{
  labelKey: string;
  events: TournamentEventView[];
  activeEventId: string;
  onSelect: (eventId: string) => void;
}>): JSX.Element | null {
  const { t } = useI18n();
  if (events.length === 0) {
    return null;
  }
  return (
    <div className="team-picker__group">
      <span className="team-picker__label">{t(labelKey)}</span>
      <div className="scroll-row">
        {events.map((event) => (
          <button
            key={`${labelKey}-${event.eventId}`}
            type="button"
            className={`chip${String(event.eventId) === activeEventId ? " is-active" : ""}`}
            aria-pressed={String(event.eventId) === activeEventId}
            onClick={() => onSelect(String(event.eventId))}
          >
            {event.eventName}
          </button>
        ))}
      </div>
    </div>
  );
}

function selectedEvents(tournament: TournamentView, activeEventId: string): TournamentEventView[] {
  if (activeEventId === ALL_EVENTS) {
    return tournament.events;
  }
  return tournament.events.filter((event) => String(event.eventId) === activeEventId);
}

function matchesPlayerSearch(values: string[], search: string): boolean {
  if (search === "") return true;
  const needle = search.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle));
}

function firstEventId(tournament: TournamentView): string {
  const ordered = [...tournament.events].sort(compareEvents);
  return ordered.length > 0 ? String(ordered[0]!.eventId) : ALL_EVENTS;
}

function TournamentPanel({ tournament }: Readonly<{ tournament: TournamentView }>): JSX.Element {
  const { t } = useI18n();
  // Im Matchmodus ist "Alle" sinnvoll (alle Tableaux); im Anmeldemodus wird
  // direkt eine Kategorie gewählt.
  const [activeEventId, setActiveEventId] = useState<string>(
    tournament.showsMatches ? ALL_EVENTS : firstEventId(tournament),
  );
  const [search, setSearch] = useState<string>("");
  const [playedOnly, setPlayedOnly] = useState<boolean>(false);

  const events = selectedEvents(tournament, activeEventId);
  // Bei genau einem gewählten Event zeigen wir je nach Modus den Tableau-Baum
  // bzw. die Round-robin-Tabelle zusätzlich zur Partienliste.
  const singleEvent = activeEventId !== ALL_EVENTS && events.length === 1 ? events[0]! : null;
  const showsBracket = singleEvent?.bracket != null;

  const players = useMemo(
    () =>
      events
        .flatMap((event) => event.players)
        .filter((player) => matchesPlayerSearch([player.name, player.name2], search)),
    [events, search],
  );
  const matches = useMemo(
    () =>
      events
        .flatMap((event) => event.matches)
        .filter((match) => matchesPlayerSearch([...match.side1Names, ...match.side2Names], search))
        .filter((match) => !playedOnly || match.status === "played"),
    [events, search, playedOnly],
  );

  return (
    <div>
      <div className="team-picker">
        <CategoryRow
          labelKey="gender.women"
          events={womenEvents(tournament.events)}
          activeEventId={activeEventId}
          onSelect={setActiveEventId}
        />
        <CategoryRow
          labelKey="gender.men"
          events={menEvents(tournament.events)}
          activeEventId={activeEventId}
          onSelect={setActiveEventId}
        />
        <CategoryRow
          labelKey="tournaments.categories"
          events={otherEvents(tournament.events)}
          activeEventId={activeEventId}
          onSelect={setActiveEventId}
        />
      </div>

      <div className="tournament-filterbar">
        <input
          type="search"
          className="player-search"
          placeholder={t("tournaments.playerSearchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {tournament.showsMatches ? (
          <>
            <button
              type="button"
              className={`chip${activeEventId === ALL_EVENTS ? " is-active" : ""}`}
              aria-pressed={activeEventId === ALL_EVENTS}
              onClick={() => setActiveEventId(ALL_EVENTS)}
            >
              {t("tournaments.allTableaux")}
            </button>
            {showsBracket ? null : (
              <button
                type="button"
                className={`chip${playedOnly ? " is-active" : ""}`}
                aria-pressed={playedOnly}
                onClick={() => setPlayedOnly((value) => !value)}
              >
                {t("tournaments.playedOnly")}
              </button>
            )}
          </>
        ) : null}
      </div>

      <TournamentPanelBody
        tournament={tournament}
        showsBracket={showsBracket}
        singleEvent={singleEvent}
        matches={matches}
        players={players}
        search={search}
      />
    </div>
  );
}

type EventView = TournamentView["events"][number];

/** Hauptinhalt eines Turnier-Panels: Tableau-Baum, Partienliste (+ Tabelle) oder
 *  im Anmeldemodus die Registrierungsliste. */
function TournamentPanelBody({
  tournament,
  showsBracket,
  singleEvent,
  matches,
  players,
  search,
}: Readonly<{
  tournament: TournamentView;
  showsBracket: boolean;
  singleEvent: EventView | null;
  matches: EventView["matches"];
  players: EventView["players"];
  search: string;
}>): JSX.Element {
  if (!tournament.showsMatches) {
    return <RegistrationTable players={players} />;
  }
  if (showsBracket && singleEvent?.bracket) {
    return <TournamentBracket bracket={singleEvent.bracket} search={search} />;
  }
  return (
    <>
      <MatchList matches={matches} />
      {singleEvent && singleEvent.pools.length > 0 ? <PoolStandings pools={singleEvent.pools} /> : null}
    </>
  );
}

export function TournamentsView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => publicApi.tournaments(), []);
  const [activeTournamentId, setActiveTournamentId] = useState<number | null>(null);

  return (
    <section>
      <ResourceView state={state} errorKey="tournaments.loadError">
        {(data) => {
          if (data.tournaments.length === 0) {
            return <div className="state">{t("tournaments.notConfigured")}</div>;
          }
          const active =
            data.tournaments.find((tournament) => tournament.id === activeTournamentId) ??
            data.tournaments[0]!;
          // Nur die validierte URL verwenden - kein Fallback auf den Rohwert,
          // der den Sanitizer (safeExternalUrl) aushebeln wuerde.
          const registrationUrl = safeExternalUrl(active.registrationUrl);
          return (
            <>
              <div className="tournament-tabs-row">
                <div className="scroll-row" role="tablist">
                  {data.tournaments.map((tournament) => (
                    <button
                      key={tournament.id}
                      type="button"
                      role="tab"
                      className={`chip${tournament.id === active.id ? " is-active" : ""}`}
                      aria-pressed={tournament.id === active.id}
                      onClick={() => setActiveTournamentId(tournament.id)}
                    >
                      {tournament.name}
                    </button>
                  ))}
                </div>
                {registrationUrl ? (
                  <a className="link-btn" href={registrationUrl} target="_blank" rel="noopener noreferrer">
                    {active.showsMatches ? t("tournaments.swisstennisLink") : t("tournaments.register")}
                  </a>
                ) : null}
              </div>
              <TournamentPanel key={active.id} tournament={active} />
            </>
          );
        }}
      </ResourceView>
    </section>
  );
}
