/**
 * Round-robin-Tabelle(n) eines Events (z. B. DM „Mixed"): je Pool eine
 * Rangliste mit Spielen, Siegen, Satz- und Game-Verhältnis (Swisstennis-Werte).
 * Wird in der Turnierbaum-Ansicht statt des Tableaus gezeigt, wenn das Event
 * im Round-robin-Modus läuft. Geteilt zwischen Waidcup- und Spielbetriebs-App.
 */
import type { JSX } from "react";
import type { PoolStanding } from "@tcw/shared";
import { useI18n } from "./I18nProvider.js";
import { PlayerLink } from "./PlayerLink.js";

export function PoolStandings({
  pools,
  search = "",
  playerUrls,
}: Readonly<{ pools: PoolStanding[]; search?: string; playerUrls?: Record<string, string> }>): JSX.Element | null {
  const { t } = useI18n();
  const needle = search.trim().toLowerCase();
  const rowMatches = (names: string[]): boolean =>
    needle !== "" && names.some((name) => name.toLowerCase().includes(needle));
  if (pools.length === 0) {
    return null;
  }
  return (
    <div className="wc-pools">
      {pools.map((pool) => (
        <div key={pool.poolName} className="wc-pool">
          {pool.poolName ? <h4 className="wc-pool__name">{pool.poolName}</h4> : null}
          <div className="wc-pool__scroll">
            <table className="wc-pool__table">
              <thead>
                <tr>
                  <th className="wc-pool__rank">{t("brackets.pool.rank")}</th>
                  <th className="wc-pool__pair">{t("brackets.pool.pair")}</th>
                  <th>{t("brackets.pool.matches")}</th>
                  <th>{t("brackets.pool.wins")}</th>
                  <th>{t("brackets.pool.sets")}</th>
                  <th>{t("brackets.pool.games")}</th>
                </tr>
              </thead>
              <tbody>
                {pool.rows.map((row, index) => (
                  <tr
                    key={`${row.rank}-${row.names.join("/")}`}
                    className={rowMatches(row.names) ? "wc-pool__row--match" : undefined}
                  >
                    <td className="wc-pool__rank">{row.rank || index + 1}</td>
                    <td className="wc-pool__pair">
                      {row.names.map((name) => (
                        <div key={name} className="wc-pool__player">
                          <PlayerLink name={name} playerUrls={playerUrls} />
                        </div>
                      ))}
                    </td>
                    <td>{row.matches}</td>
                    <td>{row.victories}</td>
                    <td>{row.sets}</td>
                    <td>{row.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
