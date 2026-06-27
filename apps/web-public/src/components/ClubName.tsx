/**
 * Stellt einen Heim-/Gastnamen dar und hebt den eigenen Club hervor.
 */
import type { JSX } from "react";
import { OWN_CLUB_NAME } from "@tcw/shared";

export function ClubName({ name }: { name: string }): JSX.Element {
  if (name === OWN_CLUB_NAME) {
    return <strong className="club-own">{name}</strong>;
  }
  return <span>{name}</span>;
}
