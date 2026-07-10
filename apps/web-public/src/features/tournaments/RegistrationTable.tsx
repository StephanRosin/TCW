/**
 * Anmeldungsliste eines Turniers mit sortierbaren Spalten (Spieler,
 * Klassierung, Anmeldedatum). Spaltenbreiten bleiben stabil.
 */
import { useMemo, useState, type JSX } from "react";
import { compareByRanking, safeExternalUrl, type RegistrationPlayer } from "@tcw/shared";
import { useI18n } from "../../i18n/I18nProvider.js";

type SortKey = "name" | "ranking" | "registered_on";
type SortDir = "asc" | "desc";

const REGISTRATION_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/;

function registrationDateValue(value: string): number {
  const match = REGISTRATION_DATE.exec(value);
  if (!match) return 0;
  return Number(match[3]) * 10000 + Number(match[2]) * 100 + Number(match[1]);
}

function compareBy(key: SortKey, a: RegistrationPlayer, b: RegistrationPlayer): number {
  if (key === "ranking") {
    return compareByRanking(a.ranking || a.ranking2, b.ranking || b.ranking2);
  }
  if (key === "registered_on") {
    return registrationDateValue(a.registeredOn) - registrationDateValue(b.registeredOn);
  }
  return a.name.localeCompare(b.name, "de-CH", { sensitivity: "base" });
}

function PlayerLine({ name, url }: Readonly<{ name: string; url: string }>): JSX.Element {
  const safeUrl = safeExternalUrl(url);
  if (name === "") {
    return <></>;
  }
  return safeUrl ? (
    <div>
      <a href={safeUrl} target="_blank" rel="noopener noreferrer">
        {name}
      </a>
    </div>
  ) : (
    <div>{name}</div>
  );
}

export function RegistrationTable({ players }: Readonly<{ players: RegistrationPlayer[] }>): JSX.Element {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<SortKey>("registered_on");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...players].sort((a, b) => {
      const result = compareBy(sortKey, a, b);
      return result !== 0 ? result * factor : a.name.localeCompare(b.name, "de-CH");
    });
  }, [players, sortKey, sortDir]);

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const arrow = (key: SortKey): string => {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  if (players.length === 0) {
    return <div className="state">{t("tournaments.noRegistrations")}</div>;
  }

  const columns: Array<{ key: SortKey; labelKey: string; className: string }> = [
    { key: "name", labelKey: "tournaments.player", className: "col-player" },
    { key: "ranking", labelKey: "tournaments.ranking", className: "col-rank" },
    { key: "registered_on", labelKey: "tournaments.registrationDate", className: "col-date" },
  ];

  return (
    <div className="table-wrap">
      <table className="board registration-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>
                <button type="button" className="sort-header" onClick={() => toggleSort(column.key)}>
                  {t(column.labelKey)}
                  {arrow(column.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player) => (
            <tr key={player.playerKey}>
              <td className="col-player">
                <PlayerLine name={player.name} url={player.playerUrl} />
                <PlayerLine name={player.name2} url={player.playerUrl2} />
              </td>
              <td className="col-rank">
                {player.ranking ? <div>{player.ranking}</div> : null}
                {player.ranking2 ? <div>{player.ranking2}</div> : null}
              </td>
              <td className="col-date">{player.registeredOn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
