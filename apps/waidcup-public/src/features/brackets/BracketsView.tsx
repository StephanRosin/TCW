/**
 * Turnierbaum-Seite: Event-Auswahl (Damen/Herren/weitere) und das Tableau des
 * gewählten Events. Vor der Auslosung erscheint ein klarer Hinweis.
 */
import { useState, type JSX } from "react";
import type { TournamentEventView } from "@tcw/shared";
import {
  DataView,
  TournamentBracket,
  menEvents,
  otherEvents,
  useI18n,
  useResource,
  womenEvents,
} from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";

function EventChips({
  label,
  events,
  activeEventId,
  onSelect,
}: {
  label: string;
  events: TournamentEventView[];
  activeEventId: number;
  onSelect: (eventId: number) => void;
}): JSX.Element | null {
  if (events.length === 0) return null;
  return (
    <div className="team-picker__group">
      <span className="team-picker__label">{label}</span>
      <div className="scroll-row" role="tablist">
        {events.map((event) => (
          <button
            key={event.eventId}
            type="button"
            role="tab"
            className="chip"
            aria-pressed={event.eventId === activeEventId}
            onClick={() => onSelect(event.eventId)}
          >
            {event.eventName}
          </button>
        ))}
      </div>
    </div>
  );
}

function BracketsPanel({ events }: { events: TournamentEventView[] }): JSX.Element {
  const { t } = useI18n();
  const firstWithBracket = events.find((event) => event.bracket !== null) ?? events[0];
  const [activeEventId, setActiveEventId] = useState<number>(firstWithBracket?.eventId ?? 0);
  const active = events.find((event) => event.eventId === activeEventId) ?? firstWithBracket;

  if (events.length === 0) {
    return <div className="state">{t("brackets.empty")}</div>;
  }

  return (
    <>
      <div className="team-picker">
        <EventChips label={t("gender.women")} events={womenEvents(events)} activeEventId={activeEventId} onSelect={setActiveEventId} />
        <EventChips label={t("gender.men")} events={menEvents(events)} activeEventId={activeEventId} onSelect={setActiveEventId} />
        <EventChips label={t("brackets.other")} events={otherEvents(events)} activeEventId={activeEventId} onSelect={setActiveEventId} />
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
