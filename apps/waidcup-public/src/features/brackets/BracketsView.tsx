/**
 * Turnierbaum-Seite: Kategorie-Chips (gleiche Struktur und Reihenfolge wie
 * bei den Matches) und das Tableau des gewählten Events. Vor der Auslosung
 * erscheint ein klarer Hinweis.
 */
import { useMemo, useState, type JSX } from "react";
import type { TournamentEventView } from "@tcw/shared";
import { DataView, TournamentBracket, useI18n, useResource } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";
import { compareWaidcupEvents } from "../../lib/events.js";

function BracketsPanel({ events }: { events: TournamentEventView[] }): JSX.Element {
  const { t } = useI18n();
  const sorted = useMemo(
    () => [...events].sort((a, b) => compareWaidcupEvents(a.eventName, b.eventName)),
    [events],
  );
  const firstWithBracket = sorted.find((event) => event.bracket !== null) ?? sorted[0];
  const [activeEventId, setActiveEventId] = useState<number>(firstWithBracket?.eventId ?? 0);
  const active = sorted.find((event) => event.eventId === activeEventId) ?? firstWithBracket;

  if (events.length === 0) {
    return <div className="state">{t("brackets.empty")}</div>;
  }

  return (
    <>
      <div className="subtabs" role="tablist">
        {sorted.map((event) => (
          <button
            key={event.eventId}
            type="button"
            role="tab"
            className="chip"
            aria-pressed={event.eventId === activeEventId}
            onClick={() => setActiveEventId(event.eventId)}
          >
            {event.eventName}
          </button>
        ))}
      </div>
      {active?.bracket ? (
        <TournamentBracket bracket={active.bracket} search="" />
      ) : (
        <div className="state">{t("brackets.noBracket")}</div>
      )}
    </>
  );
}

export function BracketsView(): JSX.Element {
  const state = useResource(() => waidcupApi.brackets(), []);
  return (
    <section>
      <DataView state={state} errorKey="brackets.loadError">
        {(data) => <BracketsPanel events={data.events} />}
      </DataView>
    </section>
  );
}
