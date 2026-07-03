/**
 * Infos-Seite: statische Turnierinformationen (Termine, geplante Tableaux,
 * Preisgelder, wichtige Hinweise). Gleicher Card-Stil wie der Rest der Seite.
 */
import type { JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";

// WS immer vor MS.
const TABLEAUX: ReadonlyArray<readonly [string, string, string]> = [
  ["WS", "R1/R5", "infos.tableau32"],
  ["WS", "R5/R9", "infos.tableau32"],
  ["MS", "R1/R5", "infos.tableau32"],
  ["MS", "R5/R9", "infos.tableau32"],
  ["DM", "R1/R5", "infos.tableau16"],
];

const PLAIN_HINTS = ["infos.hint1", "infos.hint4", "infos.hint5", "infos.hint6"];

export function InfosView(): JSX.Element {
  const { t } = useI18n();
  return (
    <section className="infos">
      <div className="infos__grid">
        <article className="infos__card">
          <h3 className="infos__card-title">📅 {t("infos.datesTitle")}</h3>
          <table className="info-tab">
            <tbody>
              <tr>
                <th>{t("infos.dateDurationLabel")}</th>
                <td>{t("infos.dateDurationValue")}</td>
              </tr>
              <tr>
                <th>{t("infos.dateFinalLabel")}</th>
                <td>{t("infos.dateFinalValue")}</td>
              </tr>
              <tr>
                <th>{t("infos.dateBackupLabel")}</th>
                <td>{t("infos.dateBackupValue")}</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="infos__card">
          <h3 className="infos__card-title">🎾 {t("infos.tableauxTitle")}</h3>
          <table className="info-tab info-tab--tableaux">
            <tbody>
              {TABLEAUX.map(([discipline, cls, sizeKey], index) => (
                <tr key={`${discipline}-${cls}-${index}`}>
                  <td className="info-tab__strong">{discipline}</td>
                  <td>{cls}</td>
                  <td className="info-tab__muted">{t(sizeKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="infos__card">
          <h3 className="infos__card-title">🏆 {t("infos.prizeTitle")}</h3>
          <div className="prize">
            <div className="prize__label">{t("infos.prizeGroup1")}</div>
            <table className="info-tab">
              <tbody>
                <tr>
                  <td>🥇</td>
                  <td>{t("infos.prizeWinner")}</td>
                  <td className="info-tab__strong">CHF 500</td>
                </tr>
                <tr>
                  <td>🥈</td>
                  <td>{t("infos.prizeFinalist")}</td>
                  <td className="info-tab__strong">CHF 200</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="prize">
            <div className="prize__label">{t("infos.prizeGroup2")}</div>
            <table className="info-tab">
              <tbody>
                <tr>
                  <td>🥇</td>
                  <td>{t("infos.prizeWinner")}</td>
                  <td className="info-tab__strong">CHF 200</td>
                </tr>
                <tr>
                  <td>🥈</td>
                  <td>{t("infos.prizeFinalist")}</td>
                  <td className="info-tab__strong">CHF 100</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="infos__card">
        <h3 className="infos__card-title">ℹ️ {t("infos.hintsTitle")}</h3>
        <ul className="info-hints">
          {PLAIN_HINTS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
          <li>
            {t("infos.hint8")}{" "}
            <a href={t("infos.hintPdfUrl")} target="_blank" rel="noopener noreferrer">
              {t("infos.hintPdf")}
            </a>
          </li>
        </ul>
      </article>
    </section>
  );
}
