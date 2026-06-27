/**
 * Agenda: laufende und bevorstehende Vereins-Veranstaltungen, nach Datum
 * sortiert. Der Anlass verlinkt auf die TCW-Detailseite (neuer Tab); der Ort
 * entfällt (immer derselbe). Letzte Spalte: Anmeldeinfo.
 */
import type { JSX } from "react";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { DataView } from "../../components/DataView.js";
import { useI18n } from "../../i18n/I18nProvider.js";

export function AgendaView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => publicApi.agenda(), []);

  return (
    <section>
      <DataView state={state} errorKey="agenda.loadError">
        {(data) =>
          data.events.length === 0 ? (
            <div className="state">{t("agenda.empty")}</div>
          ) : (
            <div className="table-wrap">
              <table className="board">
                <thead>
                  <tr>
                    <th className="agenda-col-date">{t("agenda.date")}</th>
                    <th>{t("agenda.event")}</th>
                    <th>{t("agenda.registration")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event, index) => (
                    <tr key={`${event.detailUrl}-${index}`}>
                      <td className="agenda-col-date">{event.dateLabel}</td>
                      <td>
                        {event.detailUrl ? (
                          <a href={event.detailUrl} target="_blank" rel="noopener noreferrer">
                            {event.title}
                          </a>
                        ) : (
                          event.title
                        )}
                        {event.category ? <span className="agenda-category">{event.category}</span> : null}
                      </td>
                      <td className="agenda-registration">{event.registrationLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </DataView>
    </section>
  );
}
