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

export interface RegistryMember {
  id: number;
  displayName: string;
  klassierung: string | null;
  profileUrl: string | null;
}

interface Row {
  id: number;
  mytennis_id: string | null;
  is_tcw_member: number;
  member_source: string | null;
  display_name: string;
}

/** Findet eine bestehende Zeile: zuerst per mytennis_id, sonst per name_key. */
function findExisting(db: TcwDatabase, mytennisId: string | null, nameKey: string): Row | undefined {
  if (mytennisId) {
    const byId = db.prepare("SELECT id, mytennis_id, is_tcw_member, member_source, display_name FROM player_registry WHERE mytennis_id = ?").get(mytennisId) as Row | undefined;
    if (byId) return byId;
  }
  return db.prepare("SELECT id, mytennis_id, is_tcw_member, member_source, display_name FROM player_registry WHERE mytennis_id IS NULL AND name_key = ?").get(nameKey) as Row | undefined;
}

/** Ein Name ist "echt" (kein Namensschlüssel-Fallback), wenn er sich von seinem eigenen normalisierten Schlüssel unterscheidet. */
function isRealName(name: string): boolean {
  return name.trim() !== playerNameKey(name);
}

/**
 * Bestimmt die zu speichernde member_source nach den drei Regeln:
 * - admin-Sperre: bisherige Quelle bleibt unangetastet.
 * - jemand wird neu Mitglied (0 -> 1): Quelle des Inputs übernehmen.
 * - sonst: bisherige Quelle beibehalten (Fallback auf Input-Quelle nur, falls es noch keine bisherige Zeile/Quelle gibt).
 */
function resolveMemberSource(
  memberLocked: boolean,
  wantMember: number,
  keepMember: number,
  existingSource: string | null | undefined,
  inputSource: string | null | undefined,
): string | null {
  if (memberLocked) return existingSource ?? null;
  const becomingMember = wantMember && !keepMember;
  if (becomingMember) return inputSource ?? null;
  return existingSource ?? (wantMember ? (inputSource ?? null) : null);
}

/**
 * Legt einen Spieler an oder aktualisiert ihn (Merge per mytennis_id, sonst per Namensschlüssel).
 * Gibt die `player_registry.id` der ein- bzw. aktualisierten Zeile zurück, damit Aufrufer
 * (z. B. der Team-Picker) die Zeile ohne separaten Lookup referenzieren können.
 */
export function upsertPlayer(db: TcwDatabase, input: RegistryUpsert): number {
  const nameKey = playerNameKey(input.name);
  if (nameKey === "") return 0; // leerer Name: keine Zeile angelegt, 0 als "kein Treffer"-Sentinel
  const url = safeExternalUrl(input.url ?? null) || null;
  const mytennisId = parseMyTennisId(url);
  const existing = findExisting(db, mytennisId, nameKey);

  // Mitgliedschaft: Imports degradieren nie; admin-Quelle gewinnt.
  const wantMember = input.member ? 1 : 0;
  const keepMember = existing?.is_tcw_member ?? 0;
  const memberLocked = existing?.member_source === "admin";
  const isMember = memberLocked ? keepMember : Math.max(keepMember, wantMember);
  const memberSource = resolveMemberSource(memberLocked, wantMember, keepMember, existing?.member_source, input.memberSource);

  if (existing) {
    // Ein Namensschlüssel (oder sonst ein schwacher Name) darf einen bereits vorhandenen
    // echten Anzeigenamen nie überschreiben — nur ein echter Name aktualisiert display_name.
    const displayName = isRealName(input.name) ? input.name.trim() : existing.display_name;
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
    ).run(mytennisId, nameKey, displayName, url, input.klassierung ?? null, input.license ?? null, isMember, memberSource, existing.id);
    return existing.id;
  }

  const info = db
    .prepare(
      `INSERT INTO player_registry (mytennis_id, name_key, display_name, profile_url, klassierung, license_number, is_tcw_member, member_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(mytennisId, nameKey, input.name.trim(), url, input.klassierung ?? null, input.license ?? null, isMember, memberSource);
  return Number(info.lastInsertRowid);
}

/** Namens-only-Auflösung. null bei fehlend ODER mehrdeutig (mehrere IDs auf einen name_key). */
export function resolveUrlByNameKey(db: TcwDatabase, nameKey: string): string | null {
  if (nameKey === "") return null;
  const hits = db
    .prepare("SELECT DISTINCT profile_url FROM player_registry WHERE name_key = ? AND profile_url IS NOT NULL")
    .all(nameKey) as Array<{ profile_url: string }>;
  return hits.length === 1 ? hits[0]!.profile_url : null;
}

/** Register-id für einen Namensschlüssel – nur bei GENAU einem Treffer, sonst null (weicher Link). */
export function registryIdForKey(db: TcwDatabase, nameKey: string): number | null {
  if (nameKey === "") return null;
  const rows = db.prepare("SELECT id FROM player_registry WHERE name_key = ?").all(nameKey) as Array<{ id: number }>;
  return rows.length === 1 ? rows[0]!.id : null;
}

/** Bulk-Auflösung Anzeigenamen -> URL (nur eindeutige Treffer), als name_key-Map. */
export function resolveUrlsForNames(db: TcwDatabase, names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of names) {
    const key = playerNameKey(name);
    if (key === "" || key in map) continue;
    const url = resolveUrlByNameKey(db, key);
    if (url) map[key] = url;
  }
  return map;
}

/**
 * Setzt die TCW-Mitgliedschaft eines Spielers und erzwingt member_source = 'admin'.
 * Admin ist die stärkste Stufe — Imports können sie nicht überschreiben.
 */
export function setMembership(db: TcwDatabase, id: number, isMember: boolean): void {
  db.prepare(
    "UPDATE player_registry SET is_tcw_member = ?, member_source = 'admin', updated_at = datetime('now') WHERE id = ?",
  ).run(isMember ? 1 : 0, id);
}

/**
 * Listet nur TCW-Mitglieder (is_tcw_member = 1), alphabetisch sortiert nach Anzeigenamen.
 * Optional: Filterung nach Namensteil (case-insensitive LIKE).
 */
export function listMembers(db: TcwDatabase, opts: { query?: string; limit?: number } = {}): RegistryMember[] {
  const like = opts.query && opts.query.trim() !== "" ? `%${opts.query.trim().toLowerCase()}%` : null;
  const rows = db
    .prepare(
      `SELECT id, display_name, klassierung, profile_url
         FROM player_registry
        WHERE is_tcw_member = 1 ${like ? "AND lower(display_name) LIKE ?" : ""}
        ORDER BY display_name
        LIMIT ?`,
    )
    .all(...(like ? [like, opts.limit ?? 50] : [opts.limit ?? 50])) as Array<{
    id: number;
    display_name: string;
    klassierung: string | null;
    profile_url: string | null;
  }>;
  return rows.map((r) => ({ id: r.id, displayName: r.display_name, klassierung: r.klassierung, profileUrl: r.profile_url }));
}
