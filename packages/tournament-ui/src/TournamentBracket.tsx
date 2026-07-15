/**
 * Tableau-Baum eines Turnier-Events: Spalten je Runde von der ersten Runde bis
 * zum Final (plus Sieger-Spalte). Wird vollständig gerendert, auch wenn spätere
 * Runden noch nicht ausgelost/gespielt sind (offene Plätze = "offen").
 */
import type { JSX } from "react";
import type { TournamentBracket as Bracket, TournamentBracketMatch } from "@tcw/shared";
import { useI18n } from "./I18nProvider.js";
import { PlayerLink } from "./PlayerLink.js";

function Slot({
  names,
  isWinner,
  highlight,
  playerUrls,
}: Readonly<{
  names: string[];
  isWinner: boolean;
  highlight: boolean;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  const { t } = useI18n();
  const classes = ["tbracket-slot"];
  if (isWinner) classes.push("tbracket-slot--winner");
  if (names.length === 0) classes.push("tbracket-slot--open");
  if (highlight) classes.push("tbracket-slot--match");
  return (
    <div className={classes.join(" ")}>
      {names.length === 0 ? (
        <span className="tbracket-open">{t("tournaments.tbd")}</span>
      ) : (
        names.map((name) => (
          <span key={name} className="tbracket-name">
            <PlayerLink name={name} playerUrls={playerUrls} />
          </span>
        ))
      )}
    </div>
  );
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** „18.07. · 09:00 · Platz 2" aus den (optionalen) Terminfeldern; leer, wenn nichts terminiert. */
function scheduleLabel(match: TournamentBracketMatch): string {
  const parts: string[] = [];
  const date = match.scheduledDate ? ISO_DATE.exec(match.scheduledDate) : null;
  if (date) parts.push(`${date[3]}.${date[2]}.`);
  if (match.scheduledTime) parts.push(match.scheduledTime);
  if (match.court) parts.push(match.court);
  return parts.join(" · ");
}

/** Fuss einer Baum-Partie: Ergebnis (falls gespielt), sonst Termin, sonst nichts. */
function MatchFooter({ result, schedule }: Readonly<{ result: string; schedule: string }>): JSX.Element | null {
  if (result) return <div className="tbracket-result">{result}</div>;
  if (schedule) return <div className="tbracket-schedule">{schedule}</div>;
  return null;
}

function BracketMatch({
  match,
  matchesSearch,
  playerUrls,
}: Readonly<{
  match: TournamentBracketMatch;
  matchesSearch: (names: string[]) => boolean;
  playerUrls?: Record<string, string>;
}>): JSX.Element {
  const schedule = scheduleLabel(match);
  return (
    <div className="tbracket-match">
      <Slot
        names={match.side1Names}
        isWinner={match.winnerSide === 1}
        highlight={matchesSearch(match.side1Names)}
        playerUrls={playerUrls}
      />
      <Slot
        names={match.side2Names}
        isWinner={match.winnerSide === 2}
        highlight={matchesSearch(match.side2Names)}
        playerUrls={playerUrls}
      />
      <MatchFooter result={match.result} schedule={schedule} />
    </div>
  );
}

export function TournamentBracket({
  bracket,
  search,
  playerUrls,
}: Readonly<{ bracket: Bracket; search: string; playerUrls?: Record<string, string> }>): JSX.Element {
  const { t } = useI18n();
  const needle = search.trim().toLowerCase();
  const matchesSearch = (names: string[]): boolean =>
    needle !== "" && names.some((name) => name.toLowerCase().includes(needle));
  return (
    <div className="tbracket-wrap">
      <div className="tbracket">
        {bracket.rounds.map((round) => (
          <div key={round.roundName} className="tbracket-round">
            <div className="tbracket-round__title">{round.roundName}</div>
            <div className="tbracket-round__matches">
              {round.matches.map((match, index) => (
                <BracketMatch key={index} match={match} matchesSearch={matchesSearch} playerUrls={playerUrls} />
              ))}
            </div>
          </div>
        ))}
        <div className="tbracket-round tbracket-round--champion">
          <div className="tbracket-round__title">{t("tournaments.champion")}</div>
          <div className="tbracket-round__matches">
            <div className="tbracket-match tbracket-match--single">
              <Slot
                names={bracket.championNames}
                isWinner={bracket.championNames.length > 0}
                highlight={matchesSearch(bracket.championNames)}
                playerUrls={playerUrls}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
