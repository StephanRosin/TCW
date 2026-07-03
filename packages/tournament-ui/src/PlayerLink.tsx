/**
 * Spielername, optional als Link auf sein Swisstennis-Profil (mytennis.ch).
 *
 * Die Anzeige bleibt unverändert – ohne passende URL wird schlicht der Text
 * gerendert. Die Unterstreichung erscheint nur beim Hover (CSS `.player-link`),
 * damit erkennbar ist, dass es sich um einen Link handelt.
 */
import { playerNameKey } from "@tcw/shared";
import type { JSX, ReactNode } from "react";

export function PlayerLink({
  name,
  label,
  playerUrls,
}: {
  name: string;
  label?: ReactNode;
  playerUrls?: Record<string, string>;
}): JSX.Element {
  const content = label ?? name;
  const url = playerUrls?.[playerNameKey(name)];
  if (!url) {
    return <>{content}</>;
  }
  return (
    <a className="player-link" href={url} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}
