/**
 * Zentrales Spieler-Register: kanonische Identität, Profil-URL, Klassierung und
 * TCW-Mitgliedschaft je Spieler. Imports befüllen es per UPSERT (mytennis-ID
 * first, ersatzweise Namensschlüssel); Verlinkungen und der Admin-Team-Picker
 * lösen darüber auf. Siehe docs/superpowers/specs/2026-07-03-player-registry-design.md.
 */
import { parseMyTennisId, playerNameKey, safeExternalUrl } from "@tcw/shared";
import type { TcwDatabase } from "../db/connection.js";

export interface RegistryUpsert {
  name: string;
  url?: string | null;
  klassierung?: string | null;
  license?: string | null;
  member?: boolean;
  memberSource?: "roster" | "ic-home" | "admin";
}

interface Row {
  id: number;
  mytennis_id: string | null;
  is_tcw_member: number;
  member_source: string | null;
}

/** Findet eine bestehende Zeile: zuerst per mytennis_id, sonst per name_key. */
function findExisting(db: TcwDatabase, mytennisId: string | null, nameKey: string): Row | undefined {
  if (mytennisId) {
    const byId = db.prepare("SELECT id, mytennis_id, is_tcw_member, member_source FROM player_registry WHERE mytennis_id = ?").get(mytennisId) as Row | undefined;
    if (byId) return byId;
  }
  return db.prepare("SELECT id, mytennis_id, is_tcw_member, member_source FROM player_registry WHERE mytennis_id IS NULL AND name_key = ?").get(nameKey) as Row | undefined;
}

export function upsertPlayer(db: TcwDatabase, input: RegistryUpsert): void {
  const nameKey = playerNameKey(input.name);
  if (nameKey === "") return;
  const url = safeExternalUrl(input.url ?? null) || null;
  const mytennisId = parseMyTennisId(url);
  const existing = findExisting(db, mytennisId, nameKey);

  // Mitgliedschaft: Imports degradieren nie; admin-Quelle gewinnt.
  const wantMember = input.member ? 1 : 0;
  const keepMember = existing?.is_tcw_member ?? 0;
  const memberLocked = existing?.member_source === "admin";
  const isMember = memberLocked ? keepMember : Math.max(keepMember, wantMember) ? 1 : 0;
  const memberSource = memberLocked
    ? existing!.member_source
    : wantMember && !keepMember
      ? (input.memberSource ?? null)
      : (existing?.member_source ?? (wantMember ? (input.memberSource ?? null) : null));

  if (existing) {
    db.prepare(
      `UPDATE player_registry SET
         mytennis_id = COALESCE(?, mytennis_id),
         name_key = ?,
         display_name = ?,
         profile_url = COALESCE(?, profile_url),
         klassierung = COALESCE(?, klassierung),
         license_number = COALESCE(?, license_number),
         is_tcw_member = ?,
         member_source = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    ).run(mytennisId, nameKey, input.name.trim(), url, input.klassierung ?? null, input.license ?? null, isMember, memberSource, existing.id);
    return;
  }

  db.prepare(
    `INSERT INTO player_registry (mytennis_id, name_key, display_name, profile_url, klassierung, license_number, is_tcw_member, member_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(mytennisId, nameKey, input.name.trim(), url, input.klassierung ?? null, input.license ?? null, isMember, memberSource);
}
