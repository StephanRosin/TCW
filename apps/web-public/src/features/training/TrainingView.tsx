/**
 * Trainingsplan: Tageswahl (mobil horizontal scrollbar), Platzraster 1–4
 * für die Abendstunden und mehrsprachige Legende.
 */
import { useState, type JSX } from "react";
import { PUBLIC_TRAINING_COURTS, TRAINING_DAYS, type TrainingDay } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";

const DAY_LABEL_KEYS: Record<TrainingDay, string> = {
  Montag: "training.days.monday",
  Dienstag: "training.days.tuesday",
  Mittwoch: "training.days.wednesday",
  Donnerstag: "training.days.thursday",
  Freitag: "training.days.friday",
};

const LEGEND_ITEMS: ReadonlyArray<{ labelKey: string; textKey?: string }> = [
  { labelKey: "training.legend.icCourts" },
  { labelKey: "training.legend.slots" },
  { labelKey: "training.legend.release" },
  { labelKey: "training.legend.noExtra" },
  { labelKey: "training.legend.twelveHours.label", textKey: "training.legend.twelveHours.text" },
];

export function TrainingView(): JSX.Element {
  const { t, translateKnown } = useI18n();
  const state = useResource(() => publicApi.trainingPlan(), []);
  const [activeDay, setActiveDay] = useState<TrainingDay>("Montag");

  return (
    <section>

      <div className="scroll-row" role="tablist" aria-label={t("training.daySelect")}>
        {TRAINING_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            role="tab"
            className={`chip${day === activeDay ? " is-active" : ""}`}
            aria-pressed={day === activeDay}
            onClick={() => setActiveDay(day)}
          >
            {t(DAY_LABEL_KEYS[day])}
          </button>
        ))}
      </div>

      <ResourceView state={state} errorKey="teams.loadError">
        {(data) => {
          const rows = data.days[activeDay] ?? [];
          return (
            <>
              <div className="table-wrap">
                <table className="board training-grid">
                  <thead>
                    <tr>
                      <th className="numeric">{t("training.time")}</th>
                      {PUBLIC_TRAINING_COURTS.map((court) => (
                        <th key={court} className="court-col">
                          {t("training.court", { number: court })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.time}>
                        <td className="numeric">{row.time}</td>
                        {row.courts.map((court, index) => (
                          <td key={PUBLIC_TRAINING_COURTS[index]} className="court-cell">
                            {court ? (
                              <span className="training-cell-team">{translateKnown(court)}</span>
                            ) : (
                              <span className="training-cell-empty">{t("common.none")}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="legend">
                <h3>{t("training.legendTitle")}</h3>
                <ul>
                  {LEGEND_ITEMS.map((item) => (
                    <li key={item.labelKey}>
                      {item.textKey ? (
                        <>
                          <strong>{t(item.labelKey)}:</strong> {t(item.textKey)}
                        </>
                      ) : (
                        t(item.labelKey)
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          );
        }}
      </ResourceView>
    </section>
  );
}
