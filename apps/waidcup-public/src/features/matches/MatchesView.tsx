/**
 * Matchliste: Filter nach Spielername (Freitext) und Bracket (Chips).
 * Kommende Partien oben (nächste zuerst, mit Datum/Uhrzeit/Platz), gespielte
 * darunter (neueste zuerst, mit Resultat).
 */
import { useMemo, useState, type JSX } from "react";
import type { TournamentMatch } from "@tcw/shared";
import { DataView, MatchList, useI18n, useResource } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";
import { compareWaidcupEvents } from "../../lib/events.js";

const ALL_EVENTS = 0;

function matchesPlayerSearch(match: TournamentMatch, needle: string): boolean {
  if (needle === "") return true;
  return [...match.side1Names, ...match.side2Names].some((name) =>
    name.toLowerCase().includes(needle),
  );
}

function MatchesPanel({ matches }: { matches: TournamentMatch[] }): JSX.Element {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState<number>(ALL_EVENTS);

  const events = useMemo(() => {
    const byId = new Map<number, string>();
    for (const match of matches) {
      if (!byId.has(match.eventId)) byId.set(match.eventId, match.eventName);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => compareWaidcupEvents(a.name, b.name));
  }, [matches]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return matches.filter(
      (match) =>
        (eventId === ALL_EVENTS || match.eventId === eventId) &&
        matchesPlayerSearch(match, needle),
    );
  }, [matches, search, eventId]);

  if (matches.length === 0) {
    return <div className="state">{t("brackets.empty")}</div>;
  }

  return (
    <>
      <div className="subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="chip"
          aria-pressed={eventId === ALL_EVENTS}
          onClick={() => setEventId(ALL_EVENTS)}
        >
          {t("tournaments.allTableaux")}
        </button>
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            role="tab"
            className="chip"
            aria-pressed={eventId === event.id}
            onClick={() => setEventId(event.id)}
          >
            {event.name}
          </button>
        ))}
      </div>
      <div className="pm-search waidcup-search">
        <input
          type="search"
          className="pm-input"
          placeholder={t("tournaments.playerSearchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <MatchList matches={filtered} order="upcomingFirst" />
    </>
  );
}

export function MatchesView(): JSX.Element {
  const state = useResource(() => waidcupApi.matches(), []);
  return (
    <section>
      <DataView state={state} errorKey="matches.loadError">
        {(data) => <MatchesPanel matches={data.matches} />}
      </DataView>
    </section>
  );
}
