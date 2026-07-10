/**
 * Ticker: die zuletzt gespielten Matches clubweit (alle Wettbewerbe),
 * neueste zuerst. Siegerseite fett, Doppelpartner untereinander.
 */
import { useState, type JSX } from "react";
import type { PlayerMatchParticipant } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";

/** Wie viele Matches zunächst und je „Mehr"-Klick zusätzlich gezeigt werden. */
const PAGE_SIZE = 30;

function SideCell({
  players,
  isWinner,
}: Readonly<{
  players: PlayerMatchParticipant[];
  isWinner: boolean;
}>): JSX.Element {
  return (
    <div className={isWinner ? "match-side match-side--winner" : "match-side"}>
      {players.map((player, index) => (
        <div key={index} className="match-player">
          {player.url ? (
            <a href={player.url} target="_blank" rel="noopener noreferrer">
              {player.name}
            </a>
          ) : (
            player.name
          )}
        </div>
      ))}
    </div>
  );
}

export function TickerView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => publicApi.ticker(), []);
  // Wie viele Einträge aktuell sichtbar sind; „Mehr" blendet je 30 weitere ein.
  const [visible, setVisible] = useState(PAGE_SIZE);

  return (
    <section>
      <ResourceView state={state} errorKey="ticker.loadError">
        {(data) =>
          data.matches.length === 0 ? (
            <div className="state">{t("ticker.empty")}</div>
          ) : (
            <>
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
                    {data.matches.slice(0, visible).map((match, index) => (
                      <tr key={`${match.date}-${index}`}>
                        <td>{match.date || t("common.none")}</td>
                        <td>{match.competition}</td>
                        <td>
                          <SideCell players={match.side1} isWinner={match.winnerSide === 1} />
                        </td>
                        <td>
                          <SideCell players={match.side2} isWinner={match.winnerSide === 2} />
                        </td>
                        <td className="numeric">{match.result || t("common.none")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visible < data.matches.length && (
                <div className="ticker-more">
                  <button type="button" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                    {t("ticker.more")}
                  </button>
                </div>
              )}
            </>
          )
        }
      </ResourceView>
    </section>
  );
}
