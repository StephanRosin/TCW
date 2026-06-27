/**
 * Tableau-Baum eines Turnier-Events: Spalten je Runde von der ersten Runde bis
 * zum Final (plus Sieger-Spalte). Wird vollständig gerendert, auch wenn spätere
 * Runden noch nicht ausgelost/gespielt sind (offene Plätze = "offen").
 */
import type { JSX } from "react";
import type { TournamentBracket as Bracket, TournamentBracketMatch } from "@tcw/shared";
import { useI18n } from "../../i18n/I18nProvider.js";

function Slot({ names, isWinner }: { names: string[]; isWinner: boolean }): JSX.Element {
  const { t } = useI18n();
  const classes = ["tbracket-slot"];
  if (isWinner) classes.push("tbracket-slot--winner");
  if (names.length === 0) classes.push("tbracket-slot--open");
  return (
    <div className={classes.join(" ")}>
      {names.length === 0 ? (
        <span className="tbracket-open">{t("tournaments.tbd")}</span>
      ) : (
        names.map((name, index) => (
          <span key={index} className="tbracket-name">
            {name}
          </span>
        ))
      )}
    </div>
  );
}

function BracketMatch({ match }: { match: TournamentBracketMatch }): JSX.Element {
  return (
    <div className="tbracket-match">
      <Slot names={match.side1Names} isWinner={match.winnerSide === 1} />
      <Slot names={match.side2Names} isWinner={match.winnerSide === 2} />
      {match.result ? <div className="tbracket-result">{match.result}</div> : null}
    </div>
  );
}

export function TournamentBracket({ bracket }: { bracket: Bracket }): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="tbracket-wrap">
      <div className="tbracket">
        {bracket.rounds.map((round) => (
          <div key={round.roundName} className="tbracket-round">
            <div className="tbracket-round__title">{round.roundName}</div>
            <div className="tbracket-round__matches">
              {round.matches.map((match, index) => (
                <BracketMatch key={index} match={match} />
              ))}
            </div>
          </div>
        ))}
        <div className="tbracket-round tbracket-round--champion">
          <div className="tbracket-round__title">{t("tournaments.champion")}</div>
          <div className="tbracket-round__matches">
            <div className="tbracket-match tbracket-match--single">
              <Slot names={bracket.championNames} isWinner={bracket.championNames.length > 0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
