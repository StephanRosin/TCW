/**
 * Spielermatches: Suchmaske mit Autocomplete (ab 3 Zeichen) über erfasste
 * Vereinsspieler. Nach Auswahl werden alle Matches des aktuellen Jahres aus der
 * lokalen DB gelistet – Wettbewerb, Gegner (zu Swisstennis verlinkt) und
 * Resultat; der/die Gewinner/in ist fett.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { PlayerMatchView, PlayerSuggestion } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useI18n } from "../../i18n/I18nProvider.js";

const MIN_CHARS = 3;

function NameLink({ name, url }: { name: string; url: string | null }): JSX.Element {
  if (url) {
    return (
      <a className="pm-name" href={url} target="_blank" rel="noopener noreferrer">
        {name}
      </a>
    );
  }
  return <span className="pm-name">{name}</span>;
}

/** Eine Spielseite (1–2 Spieler), durch „&" getrennt; als Sieger ggf. fett. */
function Side({ players, winner }: { players: PlayerMatchView["opponents"]; winner: boolean }): JSX.Element {
  const list = players.length > 0 ? players : [{ name: "—", url: null }];
  return (
    <span className={winner ? "pm-side pm-side--winner" : "pm-side"}>
      {list.map((player, index) => (
        <span key={index}>
          {index > 0 ? <span className="pm-amp"> & </span> : null}
          <NameLink name={player.name} url={player.url} />
        </span>
      ))}
    </span>
  );
}

function MatchRow({ match }: { match: PlayerMatchView }): JSX.Element {
  const { t } = useI18n();
  const ownWon = match.won === true;
  const oppWon = match.won === false;
  const ownSide = match.partner ? [match.player, match.partner] : [match.player];
  return (
    <article className="pm-match">
      <div className="pm-match__meta">
        <span className={`pm-badge pm-badge--${match.competitionCode}`}>{match.competition}</span>
        <span
          className={`pm-outcome ${ownWon ? "pm-outcome--won" : oppWon ? "pm-outcome--lost" : "pm-outcome--open"}`}
        >
          {match.won === null ? t("playerMatches.open") : ownWon ? t("playerMatches.won") : t("playerMatches.lost")}
        </span>
      </div>
      <div className="pm-match__body">
        <div className="pm-match__line">
          <Side players={ownSide} winner={ownWon} />
          <span className="pm-vs"> {t("playerMatches.versus")} </span>
          <Side players={match.opponents} winner={oppWon} />
        </div>
        <div className="pm-score-line">{match.result || "–"}</div>
      </div>
      {match.date ? <span className="pm-date">{match.date}</span> : null}
    </article>
  );
}

/** Abschnitt (Einzel bzw. Doppel) mit Überschrift; rendert nichts, wenn leer. */
function MatchGroup({ title, matches }: { title: string; matches: PlayerMatchView[] }): JSX.Element | null {
  if (matches.length === 0) return null;
  return (
    <section className="pm-group">
      <h3 className="pm-group__title">{title}</h3>
      <div className="pm-list">
        {matches.map((match, index) => (
          <MatchRow key={index} match={match} />
        ))}
      </div>
    </section>
  );
}

export function PlayerMatchesView(): JSX.Element {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([]);
  const [selected, setSelected] = useState<PlayerSuggestion | null>(null);
  const [matches, setMatches] = useState<PlayerMatchView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const skipNextSuggest = useRef(false);

  // Autocomplete: debounced ab MIN_CHARS Zeichen.
  useEffect(() => {
    if (skipNextSuggest.current) {
      skipNextSuggest.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      publicApi
        .playerSuggest(q)
        .then((response) => {
          if (!cancelled) setSuggestions(response.items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const choose = (player: PlayerSuggestion): void => {
    skipNextSuggest.current = true;
    setSelected(player);
    setQuery(player.name);
    setSuggestions([]);
    setMatches(null);
    setLoading(true);
    publicApi
      .playerMatches(player.key, player.name)
      .then((response) => setMatches(response.matches))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  };

  return (
    <section className="pm">
      <p className="pm-intro">{t("playerMatches.intro")}</p>

      <div className="pm-search">
        <input
          type="search"
          className="pm-input"
          placeholder={t("playerMatches.placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setMatches(null);
          }}
          autoComplete="off"
        />
        {suggestions.length > 0 && !selected ? (
          <ul className="pm-suggest">
            {suggestions.map((player) => (
              <li key={player.key}>
                <button type="button" className="pm-suggest__item" onClick={() => choose(player)}>
                  <span>{player.name}</span>
                  {player.klassierung ? <span className="pm-suggest__rank">{player.klassierung}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {query.trim().length >= MIN_CHARS && suggestions.length === 0 && !selected && !loading ? (
        <p className="pm-empty">{t("playerMatches.noSuggestions")}</p>
      ) : null}

      {loading ? <p className="pm-empty">{t("playerMatches.loading")}</p> : null}

      {selected && matches !== null && !loading ? (
        matches.length === 0 ? (
          <p className="pm-empty">{t("playerMatches.noMatches")}</p>
        ) : (
          <>
            <MatchGroup
              title={t("playerMatches.discipline.single")}
              matches={matches.filter((match) => match.discipline === "single")}
            />
            <MatchGroup
              title={t("playerMatches.discipline.double")}
              matches={matches.filter((match) => match.discipline === "double")}
            />
          </>
        )
      ) : null}
    </section>
  );
}
