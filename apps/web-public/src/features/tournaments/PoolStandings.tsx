/**
 * Round-robin-Tabelle(n) eines Turnier-Events: je Pool eine Rangliste mit
 * Spielen, Siegen, Satz- und Game-Verhältnis (offizielle Swisstennis-Werte).
 */
import type { JSX } from "react";
import type { PoolStanding } from "@tcw/shared";
import { PlayerLink } from "@tcw/tournament-ui";
import { useI18n } from "../../i18n/I18nProvider.js";

export function PoolStandings({
  pools,
  playerUrls,
}: Readonly<{ pools: PoolStanding[]; playerUrls?: Record<string, string> }>): JSX.Element | null {
  const { t } = useI18n();
  if (pools.length === 0) {
    return null;
  }
  return (
    <div className="pool-standings">
      {pools.map((pool) => (
        <div key={pool.poolName} className="pool-standings__pool">
          {pool.poolName ? <h4 className="results-subhead">{pool.poolName}</h4> : null}
          <div className="table-wrap">
            <table className="board">
              <thead>
                <tr>
                  <th>{t("results.rank")}</th>
                  <th>{t("tournaments.player1")}</th>
                  <th>{t("tournaments.poolMatches")}</th>
                  <th>{t("tournaments.poolWins")}</th>
                  <th>{t("results.sets")}</th>
                  <th>{t("tournaments.poolGames")}</th>
                </tr>
              </thead>
              <tbody>
                {pool.rows.map((row, index) => (
                  <tr key={`${row.rank}-${row.names.join("/")}`}>
                    <td>{row.rank || index + 1}</td>
                    <td>
                      {row.names.map((name) => (
                        <div key={name} className="match-player">
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
