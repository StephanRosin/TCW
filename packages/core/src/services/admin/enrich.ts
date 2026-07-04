/**
 * MyTennis-Anreicherung von Spielern und Klassierungsaktualisierung.
 *
 * - Neuer Spieler / Namensänderung → Suche und Übernahme von Klassierung + URL.
 * - Klassierungsupdate → nur echte Änderungen werden geschrieben und in
 *   `ranking_changes` protokolliert (Treffer-Zuordnung über die gespeicherte URL).
 */
import type { TcwDatabase } from "../../db/connection.js";
import { chooseBestHit, searchPlayers } from "../../integrations/mytennis/search.js";
import { upsertPlayer } from "../player-registry.js";

export interface EnrichResult {
  klassierung: string;
  myTennisID: string;
}

function splitName(name: string): { firstName: string; lastName: string } | null {
  const parts = name.trim().split(/\s+/).filter((part) => part !== "");
  if (parts.length < 2) {
    return null;
  }
  return { firstName: parts[0]!, lastName: parts[parts.length - 1]! };
}

/** Sucht den besten MyTennis-Treffer und schreibt Klassierung + URL zurück. */
export async function enrichPlayer(
  database: TcwDatabase,
  playerId: number,
  timeoutMs: number,
): Promise<EnrichResult | null> {
  const player = database.prepare("SELECT name FROM players WHERE id = ?").get(playerId) as
    | { name: string }
    | undefined;
  if (!player) {
    return null;
  }
  const name = splitName(player.name);
  if (!name) {
    return null;
  }
  const hits = await searchPlayers(player.name, timeoutMs);
  const best = chooseBestHit(hits, name.firstName, name.lastName);
  if (!best || best.url === "") {
    return null;
  }
  const klassierung = best.classification.trim().toUpperCase();
  database
    .prepare("UPDATE players SET klassierung = ?, myTennisID = ? WHERE id = ?")
    .run(klassierung, best.url, playerId);
  const registryId = syncPlayerToRegistry(database, { name: player.name, klassierung, myTennisID: best.url });
  linkPlayerRegistryId(database, playerId, registryId);
  return { klassierung, myTennisID: best.url };
}

/** Spiegelt einen Kaderspieler ins Register (Mitglied) und liefert dessen Register-id. */
export function syncPlayerToRegistry(
  db: TcwDatabase,
  player: { name: string; klassierung: string | null; myTennisID: string | null },
): number {
  return upsertPlayer(db, {
    name: player.name,
    url: player.myTennisID,
    klassierung: player.klassierung,
    member: true,
    memberSource: "roster",
  });
}

/** Verknüpft players.registry_id mit dem Register (nur bei gültiger id > 0). */
export function linkPlayerRegistryId(db: TcwDatabase, playerId: number, registryId: number): void {
  if (registryId > 0) db.prepare("UPDATE players SET registry_id = ? WHERE id = ?").run(registryId, playerId);
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export interface RankingUpdateChange {
  playerName: string;
  oldKlassierung: string;
  newKlassierung: string;
}

export interface RankingUpdateSummary {
  updated: number;
  unchanged: number;
  skipped: number;
  changes: RankingUpdateChange[];
}

interface RegistryRankRow {
  id: number;
  display_name: string;
  profile_url: string;
  klassierung: string | null;
}

/**
 * Schreibt eine geänderte Klassierung ins Register (`player_registry`) und
 * protokolliert sie in `ranking_changes`. Bei unveränderter Klassierung wird
 * nichts geschrieben (Rückgabe `false`). Netzfrei und daher ohne
 * MyTennis-Netzwerkzugriff testbar.
 */
export function applyRegistryKlassierung(db: TcwDatabase, row: RegistryRankRow, newRank: string): boolean {
  const old = (row.klassierung ?? "").toUpperCase();
  if (old === newRank.toUpperCase()) return false;
  const tx = db.transaction(() => {
    db.prepare("UPDATE player_registry SET klassierung = ?, updated_at = datetime('now') WHERE id = ?").run(
      newRank,
      row.id,
    );
    db.prepare(
      `INSERT INTO ranking_changes (player_id, player_name, myTennisID, old_klassierung, new_klassierung)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(row.id, row.display_name, row.profile_url, old, newRank);
  });
  tx();
  return true;
}

/** Kandidaten fürs Klassierungs-Update: alle Register-Einträge mit Profil-URL. */
export function selectKlassierungCandidates(db: TcwDatabase): RegistryRankRow[] {
  return db
    .prepare(
      "SELECT id, display_name, profile_url, klassierung FROM player_registry WHERE trim(coalesce(profile_url,'')) <> '' ORDER BY id",
    )
    .all() as RegistryRankRow[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Verarbeitet einen Kandidaten: sucht bei MyTennis und trägt eine geänderte Klassierung in `summary` ein. */
async function processKlassierungCandidate(
  database: TcwDatabase,
  player: RegistryRankRow,
  timeoutMs: number,
  summary: RankingUpdateSummary,
): Promise<void> {
  const name = splitName(player.display_name);
  if (!name) {
    summary.skipped += 1;
    return;
  }
  const hits = await searchPlayers(player.display_name, timeoutMs);
  const targetUrl = normalizeUrl(player.profile_url);
  const hit = hits.find((candidate) => normalizeUrl(candidate.url) === targetUrl);
  if (!hit) {
    summary.skipped += 1;
    return;
  }
  const newRank = hit.classification.trim().toUpperCase();
  if (newRank === "") {
    summary.skipped += 1;
    return;
  }
  const currentRank = (player.klassierung ?? "").trim().toUpperCase();
  if (newRank === currentRank) {
    summary.unchanged += 1;
    return;
  }
  const changed = applyRegistryKlassierung(database, player, newRank);
  if (!changed) {
    summary.unchanged += 1;
    return;
  }
  summary.updated += 1;
  summary.changes.push({ playerName: player.display_name, oldKlassierung: currentRank, newKlassierung: newRank });
}

/**
 * Aktualisiert Klassierungen aller Register-Einträge (`player_registry`) mit
 * gespeicherter MyTennis-URL — Mitglieder und Nicht-Mitglieder (Turnier-/IC-Gegner,
 * Gäste) gleichermaßen. `players` wird hierbei nicht mehr gelesen oder
 * geschrieben — die Klassierung lebt ausschließlich im Register. Die
 * MyTennis-Suchen werden über `opts.delayMs` gedrosselt, und `opts.onProgress`
 * wird nach jedem verarbeiteten Kandidaten aufgerufen (für Fortschrittsanzeigen
 * eines Hintergrundjobs).
 */
export async function updateKlassierungenFromMyTennis(
  database: TcwDatabase,
  timeoutMs: number,
  opts?: { delayMs?: number; onProgress?: (processed: number, total: number) => void },
): Promise<RankingUpdateSummary> {
  const players = selectKlassierungCandidates(database);
  const total = players.length;
  const summary: RankingUpdateSummary = { updated: 0, unchanged: 0, skipped: 0, changes: [] };

  for (let index = 0; index < players.length; index += 1) {
    await processKlassierungCandidate(database, players[index]!, timeoutMs, summary);
    opts?.onProgress?.(index + 1, total);
    const isLast = index === players.length - 1;
    if (!isLast) {
      await sleep(opts?.delayMs ?? 4000);
    }
  }
  return summary;
}
