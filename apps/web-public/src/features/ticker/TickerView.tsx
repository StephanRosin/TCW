/**
 * Ticker: die zuletzt gespielten Matches clubweit (alle Wettbewerbe),
 * neueste zuerst. Siegerseite fett, Doppelpartner untereinander.
 */
import type { JSX } from "react";
import type { TickerMatch } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { DataView } from "../../components/DataView.js";
import { useI18n } from "../../i18n/I18nProvider.js";

function SideCell({ names, isWinner }: { names: string[]; isWinner: boolean }): JSX.Element {
  return (
    <div className={isWinner ? "match-side match-side--winner" : "match-side"}>
      {names.map((name, index) => (
        <div key={index} className="match-player">
          {name}
        </div>
      ))}
    </div>
  );
}

function tickerKey(match: TickerMatch, index: number): string {
  return `${match.date}-${match.side1.join("/")}-${match.side2.join("/")}-${index}`;
}

export function TickerView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => publicApi.ticker(), []);

  return (
    <section>
      <DataView state={state} errorKey="ticker.loadError">
        {(data) =>
          data.matches.length === 0 ? (
            <div className="state">{t("ticker.empty")}</div>
          ) : (
            <div className="table-wrap">
              <table className="board">
                <thead>
                  <tr>
                    <th>{t("matches.date")}</th>
                    <th>{t("ticker.competition")}</th>
                    <th>{t("tournaments.player1")}</th>
                    <th>{t("tournaments.player2")}</th>
                    <th className="numeric">{t("matches.result")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((match, index) => (
                    <tr key={tickerKey(match, index)}>
                      <td>{match.date || t("common.none")}</td>
                      <td>{match.competition}</td>
                      <td>
                        <SideCell names={match.side1} isWinner={match.winnerSide === 1} />
                      </td>
                      <td>
                        <SideCell names={match.side2} isWinner={match.winnerSide === 2} />
                      </td>
                      <td className="numeric">{match.result || t("common.none")}</td>
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
