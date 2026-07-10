/**
 * Teams-Ansicht: Damen/Herren-Umschalter mit Teamkarten und Spielerlisten.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { CAPTAIN_STATUS, type PublicPlayer, type PublicTeam } from "@tcw/shared";
import { publicApi } from "../../api/client.js";
import { useResource } from "../../api/useResource.js";
import { ResourceView } from "../../components/ResourceView.js";
import { useI18n } from "../../i18n/I18nProvider.js";
import { translateTrainingDays } from "../../lib/trainingDays.js";
import { teamPhotoFocusY, teamPhotoPanelUrl, teamPhotoUrl, teamPhotoZoom } from "./teamPhotos.js";
import { TeamPhotoModal } from "./TeamPhotoModal.js";

type GenderSection = "damen" | "herren";

interface ActivePhoto {
  src: string;
  title: string;
}

function PlayerName({ player }: Readonly<{ player: PublicPlayer }>): JSX.Element {
  const { t } = useI18n();
  const isLeader =
    player.captainStatus === CAPTAIN_STATUS.captain ||
    player.captainStatus === CAPTAIN_STATUS.viceCaptain;
  const viceTag = player.captainStatus === CAPTAIN_STATUS.viceCaptain ? t("teams.viceCaptain") : "";
  const tag = player.captainStatus === CAPTAIN_STATUS.captain ? t("teams.captain") : viceTag;

  const nameNode = player.myTennisUrl ? (
    <a href={player.myTennisUrl} target="_blank" rel="noopener noreferrer">
      {player.name}
    </a>
  ) : (
    player.name
  );

  return (
    <span className={isLeader ? "player-name player-name--captain" : "player-name"}>
      {nameNode}
      {tag ? <span className="captain-tag"> · {tag}</span> : null}
    </span>
  );
}

function TeamCard({
  team,
  onOpenPhoto,
}: Readonly<{
  team: PublicTeam;
  onOpenPhoto: (photo: ActivePhoto) => void;
}>): JSX.Element {
  const { t, translateKnown } = useI18n();
  const displayTitle = translateKnown(team.title);
  const photoUrl = teamPhotoUrl(team.title);
  const panelUrl = teamPhotoPanelUrl(team.title);
  const photoStyle = panelUrl
    ? ({
        "--team-photo": `url('${panelUrl}')`,
        "--team-photo-y": teamPhotoFocusY(team.title) ?? "35%",
        ...(teamPhotoZoom(team.title) ? { "--team-photo-zoom": teamPhotoZoom(team.title) } : {}),
      } as CSSProperties)
    : undefined;

  return (
    <article className={photoUrl ? "card card--photo" : "card"} style={photoStyle}>
      <div className="card__head">
        {photoUrl ? (
          <button
            type="button"
            className="card__title card__title--photo"
            title={t("teams.showPhoto")}
            onClick={() => onOpenPhoto({ src: photoUrl, title: displayTitle })}
          >
            {displayTitle}
            <span className="card__title-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
            </span>
          </button>
        ) : (
          <div className="card__title">{displayTitle}</div>
        )}
        <div className="card__meta">
          {team.teamziel ? <span>{t("teams.goal", { value: team.teamziel })}</span> : null}
          {team.trainingstag ? (
            <span>{t("teams.trainingDay", { value: translateTrainingDays(team.trainingstag, t) })}</span>
          ) : null}
        </div>
      </div>
      <div className="card__body">
        <table className="board">
          <tbody>
            {team.players.map((player) => (
              <tr key={player.id} className="player-row">
                <td className="numeric">
                  {player.klassierung ? <span className="player-rank">{player.klassierung}</span> : null}
                </td>
                <td>
                  <PlayerName player={player} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function TeamsView(): JSX.Element {
  const { t } = useI18n();
  const state = useResource(() => publicApi.teams(), []);
  const [section, setSection] = useState<GenderSection>("damen");
  const [photo, setPhoto] = useState<ActivePhoto | null>(null);

  return (
    <section>
      <div className="subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="subtabs__btn"
          aria-selected={section === "damen"}
          onClick={() => setSection("damen")}
        >
          {t("gender.women")}
        </button>
        <button
          type="button"
          role="tab"
          className="subtabs__btn"
          aria-selected={section === "herren"}
          onClick={() => setSection("herren")}
        >
          {t("gender.men")}
        </button>
      </div>

      <ResourceView state={state} errorKey="teams.loadError">
        {(data) => {
          const teams = section === "damen" ? data.damen : data.herren;
          if (teams.length === 0) {
            return <div className="state">{t("teams.empty")}</div>;
          }
          return (
            <div className="cards">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} onOpenPhoto={setPhoto} />
              ))}
            </div>
          );
        }}
      </ResourceView>

      {photo ? (
        <TeamPhotoModal src={photo.src} title={photo.title} onClose={() => setPhoto(null)} />
      ) : null}
    </section>
  );
}
