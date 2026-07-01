/**
 * Klassierungen: Untertabs "Klassierungsänderungen" und
 * "Klassierungsvergleich DE/US".
 */
import type { JSX } from "react";
import { rankingTrend, SWISSTENNIS_LABEL, type RankingChange } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { DataView } from "../../components/DataView.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { formatDateOnly } from "../../lib/formatDate.js";
import type { RatingsSubView } from "../../app/navigation.js";
import { COMPARE_ROWS, levelColor, primaryLevel, COMPARE_LEVELS } from "./compareData.js";

const TREND_ARROW: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "•" };

function ChangesTable({ items }: { items: RankingChange[] }): JSX.Element {
  const { t } = useI18n();
  if (items.length === 0) {
    return <div className="state">{t("ratings.empty")}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th>{t("ratings.player")}</th>
            <th>{t("ratings.new")}</th>
            <th>{t("ratings.old")}</th>
            <th>{t("ratings.date")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const trend = rankingTrend(item.oldKlassierung, item.newKlassierung);
            return (
              <tr key={item.id}>
                <td>
                  {item.myTennisUrl ? (
                    <a href={item.myTennisUrl} target="_blank" rel="noopener noreferrer">
                      {item.playerName}
                    </a>
                  ) : (
                    item.playerName
                  )}
                </td>
                <td>
                  <span className={`change-arrow change-arrow--${trend}`} aria-hidden="true">
                    {TREND_ARROW[trend]}
                  </span>
                  {item.newKlassierung}
                </td>
                <td>{item.oldKlassierung}</td>
                <td>{formatDateOnly(item.changedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChangesPanel(): JSX.Element {
  const state = useResource(() => publicApi.rankingChanges(), []);
  return (
    <DataView state={state} errorKey="ratings.loadError">
      {(data) => <ChangesTable items={data.items} />}
    </DataView>
  );
}

function ComparePanel(): JSX.Element {
  const { t } = useI18n();
  return (
    <>
      <p className="note">{t("ratings.compareIntro")}</p>
      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr>
              <th>{t("ratings.compareTitle")}</th>
              <th>{SWISSTENNIS_LABEL}</th>
              <th>{t("ratings.level")}</th>
              <th className="numeric">NTRP</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => {
              const color = levelColor(primaryLevel(row.swiss));
              return (
                <tr key={row.lk}>
                  <td>{row.lk}</td>
                  <td style={{ color, fontWeight: 700 }}>{row.swiss}</td>
                  <td>
                    <div className="compare-bar">
                      <div
                        className="compare-bar__fill"
                        style={{ width: `${row.width}%`, background: color }}
                      />
                    </div>
                  </td>
                  <td className="numeric">{row.ntrp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="compare-legend">
        {COMPARE_LEVELS.map((level) => (
          <span key={level}>
            <span className="compare-dot" style={{ background: levelColor(level) }} />
            {level}
          </span>
        ))}
      </div>
      <p className="note">{t("ratings.note")}</p>
    </>
  );
}

interface RatingsViewProps {
  subView: RatingsSubView;
  onSubViewChange: (subView: RatingsSubView) => void;
}

export function RatingsView({ subView, onSubViewChange }: RatingsViewProps): JSX.Element {
  const { t } = useI18n();
  return (
    <section>
      <div className="subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="subtabs__btn"
          aria-selected={subView === "changes"}
          onClick={() => onSubViewChange("changes")}
        >
          {t("ratings.changes")}
        </button>
        <button
          type="button"
          role="tab"
          className="subtabs__btn"
          aria-selected={subView === "compare"}
          onClick={() => onSubViewChange("compare")}
        >
          {t("ratings.compare")}
        </button>
      </div>
      {subView === "changes" ? <ChangesPanel /> : <ComparePanel />}
    </section>
  );
}
