import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAgendaEvents } from "./agenda-source.js";

const TODAY = "2026-06-27";

function rawEvent(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    eventId: "1",
    eventTitle: "Anlass",
    earliestStartDate: "2026-07-01 00:00",
    latestEndDate: "2026-07-01 23:59",
    isFullDay: true,
    ...overrides,
  };
}

test("normalizeAgendaEvents bildet alle Datumsvarianten exakt wie die Vereinsseite ab", () => {
  const [fullSame, fullRange, timedSame, timedRange] = normalizeAgendaEvents(
    [
      rawEvent({ eventId: "a", isFullDay: true }),
      rawEvent({ eventId: "b", isFullDay: true, latestEndDate: "2026-07-03 23:59" }),
      rawEvent({
        eventId: "c",
        isFullDay: false,
        earliestStartDate: "2026-08-10 18:00",
        latestEndDate: "2026-08-10 21:00",
      }),
      rawEvent({
        eventId: "d",
        isFullDay: false,
        earliestStartDate: "2026-09-01 18:00",
        latestEndDate: "2026-09-02 12:00",
      }),
    ],
    TODAY,
  );

  assert.equal(fullSame!.dateLabel, "01.07.2026");
  assert.equal(fullRange!.dateLabel, "01.07.2026 - 03.07.2026");
  assert.equal(timedSame!.dateLabel, "10.08.2026 18:00 - 21:00");
  assert.equal(timedRange!.dateLabel, "01.09.2026 18:00 - 02.09.2026");
});

test("normalizeAgendaEvents zeigt Anmeldeinfo nur bei offener Frist (subscriptionAvailable als String)", () => {
  const [open, closed, unavailable] = normalizeAgendaEvents(
    [
      rawEvent({ eventId: "o", subscriptionAvailable: "1", subscriptionEndDate: "2026-12-31 23:59" }),
      rawEvent({ eventId: "c", subscriptionAvailable: "1", subscriptionEndDate: "2026-01-01 23:59" }),
      rawEvent({ eventId: "u", subscriptionAvailable: "0", subscriptionEndDate: "2026-12-31 23:59" }),
    ],
    TODAY,
  );

  assert.equal(open!.registrationLabel, "Anmeldung möglich bis 31.12.2026");
  assert.equal(closed!.registrationLabel, "");
  assert.equal(unavailable!.registrationLabel, "");
});

test("normalizeAgendaEvents extrahiert Kategorie und absolute Detail-URL", () => {
  const [event] = normalizeAgendaEvents(
    [
      rawEvent({
        category: { "5": { title: "Turnier" } },
        detailsUrl: "/agenda/event/123",
      }),
    ],
    TODAY,
  );
  assert.equal(event!.category, "Turnier");
  assert.equal(event!.detailUrl, "https://tcwaidberg.ch/agenda/event/123");
});

test("normalizeAgendaEvents verwirft Events ohne Pflichtfelder", () => {
  const result = normalizeAgendaEvents(
    [
      rawEvent({ eventId: "ok" }),
      { eventTitle: "ohne Id", earliestStartDate: "2026-07-01 00:00", latestEndDate: "2026-07-01 23:59" },
      rawEvent({ eventId: "ohne-titel", eventTitle: undefined }),
    ],
    TODAY,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0]!.eventId, "ok");
});
