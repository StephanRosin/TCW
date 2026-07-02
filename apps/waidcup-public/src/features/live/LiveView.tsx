/**
 * Live-Seite: „Wer spielt gerade" und „Als Nächstes" aus dem Live-Board,
 * plus Link zum chromelosen Kiosk-Modus für den Grossbildschirm.
 */
import type { JSX } from "react";
import { DataView, useI18n, useResource } from "@tcw/tournament-ui";
import { waidcupApi } from "../../api/client.js";
import { KIOSK_HASH } from "../../app/navigation.js";
import { LiveMatchRows } from "./LiveBoard.js";

export function LiveView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => waidcupApi.live(), []);

  return (
    <section>
      <DataView state={state} errorKey="live.loadError">
        {(data) =>
          data.now.length === 0 && data.upcoming.length === 0 ? (
            <div className="state">{t("live.empty")}</div>
          ) : (
            <>
              <div className="live-section-head">
                <h3 className="results-subtitle">🎾 {t("live.nowTitle")}</h3>
                <a className="link-btn" href={`#${KIOSK_HASH}`} target="_blank" rel="noopener noreferrer">
                  {t("live.openKiosk")} ↗
                </a>
              </div>
              {data.now.length === 0 ? (
                <div className="state">{t("live.nobodyPlaying")}</div>
              ) : (
                <LiveMatchRows matches={data.now} />
              )}
              {data.upcoming.length > 0 ? (
                <>
                  <h3 className="results-subtitle">{t("live.upcomingTitle")}</h3>
                  <LiveMatchRows matches={data.upcoming} />
                </>
              ) : null}
            </>
          )
        }
      </DataView>
    </section>
  );
}
