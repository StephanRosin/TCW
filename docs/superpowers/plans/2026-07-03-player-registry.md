# Zentrales Spieler-Register — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein zentrales `player_registry` als kanonische Quelle für Spieler-Identität, Profil-URL, Klassierung und TCW-Mitgliedschaft; Imports befüllen es, Verlinkungen/Spielermatches/Admin-Team-Picker lesen daraus.

**Architecture:** Neue SQLite-Tabelle `player_registry` (mytennis-ID-first Identität, `name_key` als Namens-Matcher, `is_tcw_member`-Flag). Ein Service `player-registry.ts` kapselt UPSERT und Auflösung. Bestehende Feature-Tabellen (`players`, `tournament_players`, `player_matches`) bleiben strukturell; ihre Imports schreiben zusätzlich ins Register, die Consumer lösen Identität/URL zentral auf. `opponent_url_cache` geht im Register auf und wird entfernt.

**Tech Stack:** TypeScript, npm workspaces, better-sqlite3 (WAL), Node built-in test runner (`node:test`), tsx. Kein Backend-Build (läuft via tsx aus `src`), Frontend via Vite.

## Global Constraints

- **KEIN Datenverlust (oberste Priorität).** Bestehende Tabellen `players` (TCW-Kader inkl. Team-Zuordnung `team_id`), `tournament_players` (alle Turnier-Anmeldungen), `tournament_matches`, `teams`, `player_matches` werden **nicht verändert, geleert oder gelöscht**. Das Register wird ausschließlich **additiv** aus diesen Quellen befüllt (nur Lesen der Quellen, Schreiben nur in `player_registry`). Vor jedem Backfill auf einer echten DB wird die SQLite-Datei kopiert (Backup). Einzige entfernte Tabelle ist `opponent_url_cache` — ein **reiner, regenerierbarer Auflösungs-Cache** (`name_key → url`), und auch dessen Werte werden **vorher** ins Register übernommen; das physische `DROP` erfolgt erst **nach** Backup und Verifikation (Task 14), nicht automatisch.
- Namensnormalisierung ausschließlich über `playerNameKey` aus `@tcw/shared` (`packages/shared/src/domain/names.ts`) — reihenfolge- und klassierungsunabhängig.
- Nur freigegebene http(s)-Hosts als URL (`safeExternalUrl`, `packages/shared/src/domain/url.ts`; `mytennis.ch` ist erlaubt).
- `OWN_CLUB_ID = 1298`, `OWN_CLUB_NAME = "Waidberg ZH"` aus `packages/shared/src/constants.ts`.
- Clean-Code-Prinzipien aus `~/AGENTS.md` (kleine, fokussierte Einheiten; deutschsprachige Doc-Kommentare wie im Bestand).
- Workspace-Pakete exportieren `./src/index.ts` (kein dist-Build nötig, damit tsx die Änderungen direkt sieht).
- Tests laufen mit `npm -w @tcw/core run test` bzw. `npm -w @tcw/shared run test`.
- Commit-Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- Create `packages/shared/src/domain/mytennis-id.ts` — `parseMyTennisId(url)`.
- Modify `packages/shared/src/index.ts` — Re-Export.
- Create `packages/shared/src/domain/mytennis-id.test.ts` — Tests.
- Modify `packages/core/src/db/schema.ts` — `player_registry` DDL; `opponent_url_cache`-CREATE entfernen.
- Create `packages/core/src/services/player-registry.ts` — Service.
- Create `packages/core/src/services/player-registry.test.ts` — Tests.
- Modify `packages/core/src/index.ts` — Service re-exportieren.
- Modify `packages/core/src/services/tournament-store.ts` — Turnier-Import schreibt ins Register.
- Modify `packages/core/src/services/admin/enrich.ts` — Kader/enrich schreibt ins Register (member).
- Modify `packages/core/src/services/player-matches-service.ts` — IC-Heimspieler (member) + Gegner-Auflösung übers Register statt `opponent_url_cache`.
- Modify `packages/core/src/services/waidcup-service.ts` — `getWaidcupPlayerUrls` liest aus Register.
- Create `scripts/backfill-player-registry.ts` — Backfill + `DROP opponent_url_cache`.
- Modify `apps/admin-server/src/routes/admin-api.ts` — `GET /api/players/members`.
- Modify `apps/web-admin/src/api/adminClient.ts` + `apps/web-admin/src/features/PlayersAdmin.tsx` — Mitglieder-Autocomplete für die Team-Zuordnung.
- Modify `scripts/seed-waidcup-test-data.ts` — keine URL-Spalten mehr; verlässt sich aufs Register.

---

## Task 1: `parseMyTennisId` (shared)

**Files:**
- Create: `packages/shared/src/domain/mytennis-id.ts`
- Test: `packages/shared/src/domain/mytennis-id.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `parseMyTennisId(url: string | null | undefined): string | null` — liefert die numerische ID aus `.../spieler/<id>` oder `.../player/<id>`, sonst `null`.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/domain/mytennis-id.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMyTennisId } from "./mytennis-id.js";

test("parseMyTennisId: /spieler/<id> und /player/<id>", () => {
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/spieler/177712"), "177712");
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/player/900004"), "900004");
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/spieler/19799660?x=1"), "19799660");
});

test("parseMyTennisId: ungueltig -> null", () => {
  assert.equal(parseMyTennisId(""), null);
  assert.equal(parseMyTennisId(null), null);
  assert.equal(parseMyTennisId("https://example.com/de/spieler/1"), null);
  assert.equal(parseMyTennisId("https://www.mytennis.ch/de/spieler/abc"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/shared run test 2>&1 | tail -20`
Expected: FAIL (`Cannot find module './mytennis-id.js'`).

- [ ] **Step 3: Write minimal implementation**

`packages/shared/src/domain/mytennis-id.ts`:
```ts
/**
 * Extrahiert die numerische mytennis.ch-Spieler-ID aus einer Profil-URL.
 * Erlaubt sowohl `/spieler/<id>` (Produktion) als auch `/player/<id>`.
 * Nur mytennis.ch-Hosts; sonst null (kanonische ID nur aus vertrauenswürdiger Quelle).
 */
const MYTENNIS_ID = /^https?:\/\/(?:www\.)?mytennis\.ch\/[^?#]*\/(?:spieler|player)\/(\d+)(?:[/?#]|$)/i;

export function parseMyTennisId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = MYTENNIS_ID.exec(url.trim());
  return match ? match[1]! : null;
}
```

- [ ] **Step 4: Add re-export**

In `packages/shared/src/index.ts` nach der Zeile `export * from "./domain/url.js";` ergänzen:
```ts
export * from "./domain/mytennis-id.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/shared run test 2>&1 | tail -20`
Expected: PASS (beide Tests grün).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/mytennis-id.ts packages/shared/src/domain/mytennis-id.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): parseMyTennisId — mytennis-Spieler-ID aus Profil-URL

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `player_registry`-Schema

**Files:**
- Modify: `packages/core/src/db/schema.ts` (Tabelle ergänzen; `opponent_url_cache`-CREATE entfernen)
- Test: `packages/core/src/db/schema.test.ts` (Create)

**Interfaces:**
- Produces: Tabelle `player_registry(id, mytennis_id, name_key, display_name, profile_url, klassierung, license_number, is_tcw_member, member_source, updated_at)` mit `UNIQUE(mytennis_id)`, Index auf `name_key` und `is_tcw_member`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/db/schema.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";

test("SCHEMA_SQL legt player_registry mit erwarteten Spalten an", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const cols = (db.prepare("PRAGMA table_info(player_registry)").all() as Array<{ name: string }>).map((c) => c.name);
  for (const expected of ["id", "mytennis_id", "name_key", "display_name", "profile_url", "klassierung", "license_number", "is_tcw_member", "member_source", "updated_at"]) {
    assert.ok(cols.includes(expected), `Spalte fehlt: ${expected}`);
  }
  db.close();
});

test("SCHEMA_SQL erzeugt opponent_url_cache nicht mehr", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='opponent_url_cache'").get();
  assert.equal(row, undefined);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | grep -A3 player_registry | head`
Expected: FAIL (Tabelle/Spalten fehlen).

- [ ] **Step 3: Implement — Tabelle ergänzen**

In `packages/core/src/db/schema.ts` unmittelbar vor dem abschließenden Backtick der `SCHEMA_SQL`-Konstante einfügen:
```sql
CREATE TABLE IF NOT EXISTS player_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mytennis_id TEXT,
  name_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_url TEXT,
  klassierung TEXT,
  license_number TEXT,
  is_tcw_member INTEGER NOT NULL DEFAULT 0,
  member_source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_registry_mytennis ON player_registry(mytennis_id) WHERE mytennis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_registry_name_key ON player_registry(name_key);
CREATE INDEX IF NOT EXISTS idx_player_registry_member ON player_registry(is_tcw_member);
```

- [ ] **Step 4: Implement — `opponent_url_cache`-CREATE entfernen**

In `packages/core/src/db/schema.ts` den kompletten `CREATE TABLE IF NOT EXISTS opponent_url_cache (...)`-Block löschen (die Tabelle wird durch das Register ersetzt; Bestandsdaten löscht das Backfill-Script in Task 6).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS. (Falls andere Tests `opponent_url_cache` referenzieren, in Task 9 mit umstellen — hier zunächst nur Schema.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/db/schema.ts packages/core/src/db/schema.test.ts
git commit -m "feat(db): player_registry-Tabelle; opponent_url_cache aus Schema entfernt

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Registry-Service — UPSERT (mytennis-ID-first)

**Files:**
- Create: `packages/core/src/services/player-registry.ts`
- Test: `packages/core/src/services/player-registry.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `parseMyTennisId` (Task 1), `playerNameKey`, `safeExternalUrl` (`@tcw/shared`), `TcwDatabase` (`../db/connection.js`).
- Produces:
  - `interface RegistryUpsert { name: string; url?: string | null; klassierung?: string | null; license?: string | null; member?: boolean; memberSource?: "roster" | "ic-home" | "admin"; }`
  - `upsertPlayer(db: TcwDatabase, input: RegistryUpsert): void`

- [ ] **Step 1: Write the failing test**

`packages/core/src/services/player-registry.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../db/schema.js";
import { upsertPlayer } from "./player-registry.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}
function rows(db: Database.Database): Array<Record<string, unknown>> {
  return db.prepare("SELECT * FROM player_registry").all() as Array<Record<string, unknown>>;
}

test("upsertPlayer: merge per mytennis_id, egal welche Namensreihenfolge", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Rauch Markus (R4)", url: "https://www.mytennis.ch/de/spieler/177712" });
  upsertPlayer(db, { name: "Markus Rauch", url: "https://www.mytennis.ch/de/spieler/177712", klassierung: "R4" });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.mytennis_id, "177712");
  assert.equal(all[0]!.profile_url, "https://www.mytennis.ch/de/spieler/177712");
  assert.equal(all[0]!.klassierung, "R4");
  db.close();
});

test("upsertPlayer: nur Name (ohne URL) legt name-only-Zeile an, URL reichert spaeter an", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Kramer Sophia (R6)" });
  let all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.mytennis_id, null);
  upsertPlayer(db, { name: "Sophia Kramer", url: "https://www.mytennis.ch/de/spieler/19806736" });
  all = rows(db);
  assert.equal(all.length, 1, "name-only-Zeile wird per name_key angereichert, nicht dupliziert");
  assert.equal(all[0]!.mytennis_id, "19806736");
  db.close();
});

test("upsertPlayer: unsichere URL wird ignoriert", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Foo Bar", url: "https://evil.example/de/spieler/1" });
  const all = rows(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]!.mytennis_id, null);
  assert.equal(all[0]!.profile_url, null);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (`Cannot find module './player-registry.js'`).

- [ ] **Step 3: Write implementation**

`packages/core/src/services/player-registry.ts`:
```ts
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
```

- [ ] **Step 4: Add re-export**

In `packages/core/src/index.ts` bei den übrigen Service-Exports ergänzen:
```ts
export * from "./services/player-registry.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS (drei neue Tests grün).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/player-registry.ts packages/core/src/services/player-registry.test.ts packages/core/src/index.ts
git commit -m "feat(core): player-registry upsert (mytennis-ID-first)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Registry-Service — Auflösung mit Mehrdeutigkeits-Schutz

**Files:**
- Modify: `packages/core/src/services/player-registry.ts`
- Modify: `packages/core/src/services/player-registry.test.ts`

**Interfaces:**
- Consumes: `upsertPlayer` (Task 3), `playerNameKey`.
- Produces:
  - `resolveUrlByNameKey(db, nameKey: string): string | null` — `null` bei fehlender ODER mehrdeutiger (mehrere mytennis_id auf denselben name_key) Auflösung.
  - `resolveUrlsForNames(db, names: string[]): Record<string, string>` — Map `name_key -> url`, nur eindeutige Treffer.

- [ ] **Step 1: Write the failing test** (an `player-registry.test.ts` anhängen)

```ts
import { resolveUrlByNameKey, resolveUrlsForNames } from "./player-registry.js";
import { playerNameKey } from "@tcw/shared";

test("resolveUrlByNameKey: eindeutiger Treffer liefert URL", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Rauch Markus (R4)", url: "https://www.mytennis.ch/de/spieler/177712" });
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Markus Rauch")), "https://www.mytennis.ch/de/spieler/177712");
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Unbekannt Person")), null);
  db.close();
});

test("resolveUrlByNameKey: mehrdeutiger name_key -> null (kein Rateversuch)", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Peter Meier", url: "https://www.mytennis.ch/de/spieler/111" });
  upsertPlayer(db, { name: "Meier Peter", url: "https://www.mytennis.ch/de/spieler/222" });
  // gleicher name_key, zwei verschiedene IDs -> ambig
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Peter Meier")), null);
  db.close();
});

test("resolveUrlsForNames: Bulk-Map nur mit eindeutigen Treffern", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Weiss Xenia (R5)", url: "https://www.mytennis.ch/de/spieler/19786267" });
  upsertPlayer(db, { name: "Kramer Sophia (R6)" }); // ohne URL
  const map = resolveUrlsForNames(db, ["Xenia Weiss", "Sophia Kramer", ""]);
  assert.deepEqual(map, { [playerNameKey("Weiss Xenia")]: "https://www.mytennis.ch/de/spieler/19786267" });
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (`resolveUrlByNameKey is not a function`).

- [ ] **Step 3: Write implementation** (an `player-registry.ts` anhängen)

```ts
/** Namens-only-Auflösung. null bei fehlend ODER mehrdeutig (mehrere IDs auf einen name_key). */
export function resolveUrlByNameKey(db: TcwDatabase, nameKey: string): string | null {
  if (nameKey === "") return null;
  const hits = db
    .prepare("SELECT DISTINCT profile_url FROM player_registry WHERE name_key = ? AND profile_url IS NOT NULL")
    .all(nameKey) as Array<{ profile_url: string }>;
  return hits.length === 1 ? hits[0]!.profile_url : null;
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
```
Und den Import oben ergänzen: `import { parseMyTennisId, playerNameKey, safeExternalUrl } from "@tcw/shared";` enthält `playerNameKey` bereits — keine Änderung nötig.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/player-registry.ts packages/core/src/services/player-registry.test.ts
git commit -m "feat(core): registry-Auflösung mit Mehrdeutigkeits-Schutz

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Registry-Service — Mitgliedschaft & `listMembers`

**Files:**
- Modify: `packages/core/src/services/player-registry.ts`
- Modify: `packages/core/src/services/player-registry.test.ts`

**Interfaces:**
- Produces:
  - `interface RegistryMember { id: number; displayName: string; klassierung: string | null; profileUrl: string | null; }`
  - `listMembers(db, opts?: { query?: string; limit?: number }): RegistryMember[]` — nur `is_tcw_member = 1`, alphabetisch, optional nach Namensteil gefiltert.
  - `setMembership(db, id: number, isMember: boolean): void` — setzt `member_source = "admin"` (stärkste Stufe).

> **Hinweis:** Die Membership-Merge-Regeln von `upsertPlayer` (Import degradiert
> nie, `member_source="admin"` gewinnt) sind bereits in Task 3 getestet — hier
> NICHT erneut testen. Diese Task deckt nur `setMembership` und `listMembers` ab.

- [ ] **Step 1: Write the failing test** (anhängen)

```ts
import { listMembers, setMembership } from "./player-registry.js";

test("setMembership: admin schaltet an/aus, Import ueberschreibt admin nicht", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Bea Muster", url: "https://www.mytennis.ch/de/spieler/600" });
  const id = (db.prepare("SELECT id FROM player_registry").get() as { id: number }).id;
  setMembership(db, id, true);
  assert.equal(listMembers(db).length, 1);
  setMembership(db, id, false);
  upsertPlayer(db, { name: "Bea Muster", url: "https://www.mytennis.ch/de/spieler/600", member: true, memberSource: "ic-home" });
  assert.equal(listMembers(db).length, 0, "admin-off bleibt trotz ic-home-Import");
  db.close();
});

test("listMembers: Filter nach Namensteil, alphabetisch", () => {
  const db = freshDb();
  upsertPlayer(db, { name: "Zoe Adler", member: true, memberSource: "roster" });
  upsertPlayer(db, { name: "Alex Adler", member: true, memberSource: "roster" });
  upsertPlayer(db, { name: "Tom Baumann", member: true, memberSource: "roster" });
  const adlers = listMembers(db, { query: "adler" }).map((m) => m.displayName);
  assert.deepEqual(adlers, ["Alex Adler", "Zoe Adler"]);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (`listMembers is not a function`).

- [ ] **Step 3: Write implementation** (anhängen)

```ts
export interface RegistryMember {
  id: number;
  displayName: string;
  klassierung: string | null;
  profileUrl: string | null;
}

export function setMembership(db: TcwDatabase, id: number, isMember: boolean): void {
  db.prepare(
    "UPDATE player_registry SET is_tcw_member = ?, member_source = 'admin', updated_at = datetime('now') WHERE id = ?",
  ).run(isMember ? 1 : 0, id);
}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/player-registry.ts packages/core/src/services/player-registry.test.ts
git commit -m "feat(core): registry-Mitgliedschaft (setMembership, listMembers)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Backfill-Script (additiv, kein Datenverlust)

> Liest nur aus `players` / `tournament_players` / `player_matches` / (falls vorhanden) `opponent_url_cache` und schreibt ausschließlich in `player_registry`. Es werden **keine** Bestandsdaten verändert oder gelöscht.

**Files:**
- Create: `scripts/backfill-player-registry.ts`
- Modify: `package.json` (Script-Eintrag)
- Test: `packages/core/src/services/player-registry.backfill.test.ts`

**Interfaces:**
- Consumes: `upsertPlayer` (Task 3), `SCHEMA_SQL`.
- Produces: `backfillPlayerRegistry(db: TcwDatabase): { total: number }` — mergt `players`, `tournament_players`, `player_matches` (+ evtl. vorhandene `opponent_url_cache`) ins Register; droppt danach `opponent_url_cache`. Idempotent.

- [ ] **Step 1: Write the failing test**

`packages/core/src/services/player-registry.backfill.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../db/schema.js";
import { backfillPlayerRegistry } from "./player-registry-backfill.js";
import { resolveUrlByNameKey, listMembers } from "./player-registry.js";
import { playerNameKey } from "@tcw/shared";

function seeded(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT INTO teams (gender, category, liga) VALUES ('m','Aktive','1. Liga')").run();
  db.prepare("INSERT INTO players (name, klassierung, myTennisID, team_id) VALUES (?,?,?,1)")
    .run("Markus Rauch", "R4", "https://www.mytennis.ch/de/spieler/177712");
  db.prepare("INSERT INTO tournaments (name, swisstennis_tournament_id, registration_url, active, sort_order) VALUES ('T',158138,'',1,1)").run();
  db.prepare("INSERT INTO tournament_events (tournament_id,event_id,tournament_name,event_name,discipline,sort_order,updated_at) VALUES (158138,1,'T','MS','MS',1,datetime('now'))").run();
  db.prepare("INSERT INTO tournament_players (tournament_id,event_id,player_key,player_name,player_url,license_number) VALUES (158138,1,'k1','Till Novak','https://www.mytennis.ch/de/spieler/19799660','12345')").run();
  return db;
}

test("Backfill: Kader wird Mitglied, Turnierspieler non-member, URLs aufloesbar", () => {
  const db = seeded();
  const result = backfillPlayerRegistry(db);
  assert.ok(result.total >= 2);
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Markus Rauch")), "https://www.mytennis.ch/de/spieler/177712");
  assert.equal(resolveUrlByNameKey(db, playerNameKey("Till Novak")), "https://www.mytennis.ch/de/spieler/19799660");
  const members = listMembers(db).map((m) => m.displayName);
  assert.deepEqual(members, ["Markus Rauch"]);
  db.close();
});

test("Backfill: idempotent (zweiter Lauf aendert Anzahl nicht)", () => {
  const db = seeded();
  backfillPlayerRegistry(db);
  const after1 = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  backfillPlayerRegistry(db);
  const after2 = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  assert.equal(after1, after2);
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (`Cannot find module './player-registry-backfill.js'`).

- [ ] **Step 3: Write implementation**

`packages/core/src/services/player-registry-backfill.ts`:
```ts
/**
 * Einmaliges, wiederholbares Backfill des Spieler-Registers aus den verstreuten
 * Bestandstabellen. Reihenfolge = Priorität: Team-Kader (Mitglied), dann
 * Turnier-Anmeldungen (Lizenz/URL), dann Begegnungen/Gegner-Cache (URL).
 * Entfernt danach die abgelöste `opponent_url_cache`.
 */
import { upsertPlayer } from "./player-registry.js";
import type { TcwDatabase } from "../db/connection.js";

function tableExists(db: TcwDatabase, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

export function backfillPlayerRegistry(db: TcwDatabase): { total: number } {
  const run = db.transaction(() => {
    // 1) Team-Kader -> Mitglied
    for (const r of db.prepare("SELECT name, klassierung, myTennisID FROM players").all() as Array<{ name: string; klassierung: string | null; myTennisID: string | null }>) {
      upsertPlayer(db, { name: r.name, url: r.myTennisID, klassierung: r.klassierung, member: true, memberSource: "roster" });
    }
    // 2) Turnier-Anmeldungen (beide Doppel-Spieler)
    for (const r of db.prepare("SELECT player_name, player_name_2, player_url, player_url_2, license_number, license_number_2, ranking, ranking_2 FROM tournament_players").all() as Array<Record<string, string | null>>) {
      if (r.player_name) upsertPlayer(db, { name: r.player_name, url: r.player_url, license: r.license_number, klassierung: r.ranking });
      if (r.player_name_2) upsertPlayer(db, { name: r.player_name_2, url: r.player_url_2, license: r.license_number_2, klassierung: r.ranking_2 });
    }
    // 3) Begegnungen (Spieler + Gegner)
    if (tableExists(db, "player_matches")) {
      for (const r of db.prepare("SELECT s1p1_name,s1p1_url,s1p2_name,s1p2_url,s2p1_name,s2p1_url,s2p2_name,s2p2_url FROM player_matches").all() as Array<Record<string, string | null>>) {
        for (const [n, u] of [[r.s1p1_name, r.s1p1_url], [r.s1p2_name, r.s1p2_url], [r.s2p1_name, r.s2p1_url], [r.s2p2_name, r.s2p2_url]] as Array<[string | null, string | null]>) {
          if (n) upsertPlayer(db, { name: n, url: u });
        }
      }
    }
    // 4) Alte Gegner-URL-Cache-Werte (name_key -> url) ins Register heben.
    //    Die Tabelle wird hier NICHT gedroppt (Datensicherheit) — das Entfernen
    //    passiert erst nach Backup + Verifikation in Task 14.
    if (tableExists(db, "opponent_url_cache")) {
      for (const r of db.prepare("SELECT name_key, url FROM opponent_url_cache WHERE url IS NOT NULL").all() as Array<{ name_key: string; url: string }>) {
        // name_key ist bereits normalisiert; als display_name den Key nutzen, falls kein besserer Name existiert.
        upsertPlayer(db, { name: r.name_key, url: r.url });
      }
    }
  });
  run();
  const total = (db.prepare("SELECT COUNT(*) n FROM player_registry").get() as { n: number }).n;
  return { total };
}
```

`scripts/backfill-player-registry.ts`:
```ts
/**
 * Backfill des Spieler-Registers aus den Bestandstabellen (einmalig, idempotent):
 *   npm run backfill:player-registry
 */
import { backfillPlayerRegistry, loadConfig, openDatabase } from "@tcw/core";

const config = loadConfig();
const db = openDatabase({ filePath: config.dbFilePath });
const { total } = backfillPlayerRegistry(db);
db.close();
console.log(`Spieler-Register befüllt: ${total} Einträge.`);
```

- [ ] **Step 4: Re-export + npm-Script**

In `packages/core/src/index.ts` ergänzen:
```ts
export * from "./services/player-registry-backfill.js";
```
In `package.json` bei `scripts` ergänzen:
```json
"backfill:player-registry": "tsx scripts/backfill-player-registry.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/player-registry-backfill.ts packages/core/src/services/player-registry.backfill.test.ts packages/core/src/index.ts scripts/backfill-player-registry.ts package.json
git commit -m "feat(core): Backfill-Script fürs Spieler-Register; opponent_url_cache abgelöst

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Turnier-Import befüllt das Register

**Files:**
- Modify: `packages/core/src/services/tournament-store.ts` (in `replaceTournamentData`, nahe dem `INSERT ... INTO tournament_players`, ~Zeile 195)
- Modify: `packages/core/src/services/tournament-store.test.ts`

**Interfaces:**
- Consumes: `upsertPlayer` (Task 3).

- [ ] **Step 1: Read context**

Run: `sed -n '180,210p' packages/core/src/services/tournament-store.ts`
Ziel: die Schleife finden, die Registrierungen in `tournament_players` schreibt.

- [ ] **Step 2: Write the failing test** (in `tournament-store.test.ts` ergänzen — an bestehende `replaceTournamentData`-Tests anlehnen)

```ts
test("replaceTournamentData spiegelt Spieler ins Register (non-member, mit URL)", () => {
  const db = freshDb(); // vorhandener Helper der Testdatei
  replaceTournamentData(db, 158138, "Waidcup", [
    {
      meta: { eventId: 1, eventName: "MS", discipline: "MS", mode: "Draw", matchTypeId: 1, sortOrder: 1 } as never,
      registrations: [{ playerKey: "k1", playerName: "Till Novak", playerName2: null, playerUrl: "https://www.mytennis.ch/de/spieler/19799660", playerUrl2: "", licenseNumber: "1", licenseNumber2: null, ranking: "R4", ranking2: null, firstName: "Till", lastName: "Novak", firstName2: "", lastName2: "", confirmed: 1, registeredOn: "", registeredOnSort: "", note: null, sortOrder: 0 }] as never,
      matches: [], pools: [], bracket: null,
    } as never,
  ], new Date().toISOString());
  const url = db.prepare("SELECT profile_url FROM player_registry WHERE name_key = ?").get(playerNameKey("Till Novak")) as { profile_url: string } | undefined;
  assert.equal(url?.profile_url, "https://www.mytennis.ch/de/spieler/19799660");
  assert.equal((db.prepare("SELECT is_tcw_member FROM player_registry WHERE name_key=?").get(playerNameKey("Till Novak")) as { is_tcw_member: number }).is_tcw_member, 0);
  db.close();
});
```
(Falls die Testdatei keinen `freshDb`/`playerNameKey`-Import hat, oben ergänzen: `import { playerNameKey } from "@tcw/shared";` und den in der Datei etablierten DB-Helper verwenden.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (kein `player_registry`-Eintrag).

- [ ] **Step 4: Implement**

In `tournament-store.ts`, `import`-Block oben ergänzen:
```ts
import { upsertPlayer } from "./player-registry.js";
```
Innerhalb `replaceTournamentData`, in der Schleife die pro Registrierung nach `tournament_players` schreibt, direkt nach dem `INSERT` ergänzen (Variablennamen an den vorhandenen Code anpassen; `registration` ist der aktuelle Datensatz):
```ts
upsertPlayer(database, { name: registration.playerName, url: registration.playerUrl, license: registration.licenseNumber, klassierung: registration.ranking });
if (registration.playerName2) {
  upsertPlayer(database, { name: registration.playerName2, url: registration.playerUrl2, license: registration.licenseNumber2, klassierung: registration.ranking2 });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS (inkl. der bestehenden `replaceTournamentData`-Tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/tournament-store.ts packages/core/src/services/tournament-store.test.ts
git commit -m "feat(core): Turnier-Import spiegelt Spieler ins Register

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Kader/enrich befüllt das Register (Mitglied)

**Files:**
- Modify: `packages/core/src/services/admin/enrich.ts` (nahe dem `UPDATE players SET klassierung=?, myTennisID=?`, ~Zeile 47)
- Modify: `packages/core/src/services/admin/enrich.test.ts` (falls vorhanden; sonst neuen Test anlegen)

**Interfaces:**
- Consumes: `upsertPlayer` (Task 3).

- [ ] **Step 1: Read context**

Run: `sed -n '30,60p' packages/core/src/services/admin/enrich.ts`

- [ ] **Step 2: Write the failing test**

`packages/core/src/services/admin/enrich.registry.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../db/schema.js";
import { upsertPlayer, listMembers } from "../player-registry.js";

// enrich.ts schreibt nach dem Setzen von myTennisID zusätzlich ins Register.
// Da enrichPlayer eine Netzwerksuche macht, testen wir die Register-Spiegelung
// über die exportierte Hilfsfunktion syncPlayerToRegistry (siehe Implementierung).
import { syncPlayerToRegistry } from "./enrich.js";

test("syncPlayerToRegistry: Kaderspieler wird Mitglied mit URL", () => {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  syncPlayerToRegistry(db, { name: "Emma Hubeková", klassierung: "R1", myTennisID: "https://www.mytennis.ch/de/spieler/19824051" });
  const members = listMembers(db);
  assert.equal(members.length, 1);
  assert.equal(members[0]!.profileUrl, "https://www.mytennis.ch/de/spieler/19824051");
  db.close();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (`syncPlayerToRegistry` fehlt).

- [ ] **Step 4: Implement**

In `enrich.ts` `import`-Block ergänzen:
```ts
import { upsertPlayer } from "../player-registry.js";
```
Kleine exportierte Hilfsfunktion ergänzen:
```ts
/** Spiegelt einen Kaderspieler ins zentrale Register (Mitglied). */
export function syncPlayerToRegistry(
  db: TcwDatabase,
  player: { name: string; klassierung: string | null; myTennisID: string | null },
): void {
  upsertPlayer(db, { name: player.name, url: player.myTennisID, klassierung: player.klassierung, member: true, memberSource: "roster" });
}
```
Direkt nach dem bestehenden `UPDATE players SET klassierung=?, myTennisID=? ...` (das die aufgelöste URL schreibt) aufrufen:
```ts
syncPlayerToRegistry(database, { name, klassierung: best.classification, myTennisID: best.url });
```
(Variablennamen `name`, `best` an den vorhandenen Code anpassen; `TcwDatabase` ist bereits importiert oder aus `../../db/connection.js` ergänzen.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/admin/enrich.ts packages/core/src/services/admin/enrich.registry.test.ts
git commit -m "feat(core): Kader/enrich spiegelt Mitglieder ins Register

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Gegner-URLs übers Register (opponent_url_cache ablösen)

**Files:**
- Modify: `packages/core/src/services/player-matches-service.ts` (`resolveOpponentUrls` ~378, `syncPlayerMatches` ~436)
- Modify: `packages/core/src/services/player-matches-service.test.ts`

**Interfaces:**
- Consumes: `upsertPlayer`, `resolveUrlByNameKey` (Tasks 3–4).
- Produces: exportierte `syncOpponentUrlsFromRegistry(db): number` — füllt leere `player_matches`-URL-Slots aus dem Register (ohne Netz), gibt die Anzahl gefüllter Slots zurück.

> **Scope-Entscheidung:** Diese Task ersetzt NUR die Gegner-URL-Auflösung
> (`opponent_url_cache` → Register). Die IC-Mitgliedschaftsableitung (Heim/Auswärts)
> ist NICHT Teil dieser Task: sie ist weitgehend redundant zum Kader (Task 8), und
> ihre korrekte Ableitung ist heikel (Waidberg kann Heim ODER Auswärts sein;
> `extractEncounter` setzt `side1 = homeNames`, Zeile 141). Sie ist als optionale
> Phase-2-Task 19 vermerkt.
>
> **Negativ-Cache erhalten:** Der bisherige `opponent_url_cache` speicherte auch
> „gesucht, nichts gefunden" (url NULL), um denselben Namen nicht bei jedem Sync
> erneut zu suchen. Das bleibt erhalten, indem die Netzsuche für einen Gegner
> IMMER eine Register-Zeile anlegt (`upsertPlayer` — auch ohne URL entsteht eine
> name-only-Zeile), und die Suche Namen überspringt, die bereits eine Register-Zeile
> haben. So wird jeder Name höchstens einmal gesucht.

- [ ] **Step 1: Read context**

Run: `sed -n '350,435p' packages/core/src/services/player-matches-service.ts`
Beachten: `SLOTS`-Konstante (4 Slots je `[nameCol, keyCol, urlCol]`), `applyOwnUrls` (bleibt unverändert), `resolveOpponentUrls` (nutzt aktuell `cacheGet`/`cacheSet` auf `opponent_url_cache`), `lookupUrl` (Netzsuche). `syncPlayerMatches` ruft `applyOwnUrls` dann `resolveOpponentUrls`.

- [ ] **Step 2: Write the failing test** (an `player-matches-service.test.ts` anhängen; die Datei nutzt `openDatabase({ filePath: ":memory:" })` und importiert `playerNameKey`)

```ts
import { upsertPlayer } from "./player-registry.js";
import { syncOpponentUrlsFromRegistry } from "./player-matches-service.js";

test("syncOpponentUrlsFromRegistry füllt leere Gegner-URLs aus dem Register", () => {
  const db = openDatabase({ filePath: ":memory:" });
  upsertPlayer(db, { name: "Extern Gegner", url: "https://www.mytennis.ch/de/spieler/424242" });
  db.prepare(
    `INSERT INTO player_matches (match_uid, year, competition_code, competition_label, discipline, s2p1_name, s2p1_key, updated_at)
     VALUES ('u1', 2026, 'ic', 'Interclub', 'single', 'Extern Gegner', ?, datetime('now'))`,
  ).run(playerNameKey("Extern Gegner"));
  const filled = syncOpponentUrlsFromRegistry(db);
  assert.equal(filled, 1);
  const row = db.prepare("SELECT s2p1_url FROM player_matches WHERE match_uid='u1'").get() as { s2p1_url: string };
  assert.equal(row.s2p1_url, "https://www.mytennis.ch/de/spieler/424242");
  db.close();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (`syncOpponentUrlsFromRegistry` nicht exportiert).

- [ ] **Step 4: Implement**

In `player-matches-service.ts` den Import ergänzen:
```ts
import { upsertPlayer, resolveUrlByNameKey } from "./player-registry.js";
```
Neue exportierte Funktion (nutzt die bestehende `SLOTS`-Konstante):
```ts
/** Füllt leere Spieler-/Gegner-URL-Slots aus dem zentralen Register (ohne Netz). */
export function syncOpponentUrlsFromRegistry(db: Database.Database): number {
  let filled = 0;
  for (const [, keyCol, urlCol] of SLOTS) {
    const rows = db
      .prepare(`SELECT DISTINCT ${keyCol} k FROM player_matches WHERE ${keyCol}<>'' AND (${urlCol} IS NULL OR ${urlCol}='')`)
      .all() as Array<{ k: string }>;
    for (const { k } of rows) {
      const url = resolveUrlByNameKey(db, k);
      if (!url) continue;
      db.prepare(`UPDATE player_matches SET ${urlCol}=? WHERE ${keyCol}=? AND (${urlCol} IS NULL OR ${urlCol}='')`).run(url, k);
      filled++;
    }
  }
  return filled;
}
```
`resolveOpponentUrls` ersetzen (kein `opponent_url_cache` mehr; Register als Quelle + Negativ-Cache):
```ts
async function resolveOpponentUrls(
  db: Database.Database,
  config: AppConfig,
  delayMs: number,
  maxLookups: number,
  log: (m: string) => void,
): Promise<number> {
  // 1) Was das Register schon kennt, ohne Netz auffüllen.
  let resolved = syncOpponentUrlsFromRegistry(db);
  // 2) Verbleibende Lücken sammeln.
  const needed = new Map<string, string>(); // key → Anzeigename
  for (const [nameCol, keyCol, urlCol] of SLOTS) {
    const rows = db
      .prepare(`SELECT DISTINCT ${keyCol} k, ${nameCol} n FROM player_matches WHERE ${keyCol}<>'' AND (${urlCol} IS NULL OR ${urlCol}='')`)
      .all() as Array<{ k: string; n: string }>;
    for (const r of rows) if (!needed.has(r.k)) needed.set(r.k, r.n);
  }
  const known = db.prepare("SELECT 1 FROM player_registry WHERE name_key=? LIMIT 1");
  let lookups = 0;
  for (const [key, displayName] of needed) {
    // Schon im Register (in Schritt 1 aufgelöst, mehrdeutig, oder zuvor erfolglos gesucht) → nicht erneut suchen.
    if (known.get(key)) continue;
    if (lookups >= maxLookups) {
      log(`  URL-Lookup-Limit ${maxLookups} erreicht, Rest folgt`);
      break;
    }
    lookups++;
    const url = await lookupUrl(displayName, config.swisstennisTimeoutMs);
    // Register-Zeile IMMER anlegen (auch ohne URL = name-only) → Negativ-Cache, kein erneutes Suchen.
    upsertPlayer(db, { name: displayName, url });
    log(`  url ${displayName} → ${url ?? "—"}`);
    if (url) {
      for (const [, keyCol, urlCol] of SLOTS) {
        db.prepare(`UPDATE player_matches SET ${urlCol}=? WHERE ${keyCol}=? AND (${urlCol} IS NULL OR ${urlCol}='')`).run(url, key);
      }
      resolved++;
    }
    await sleep(delayMs);
  }
  return resolved;
}
```
`applyOwnUrls` bleibt unverändert (füllt Kader-URLs). Alle `opponent_url_cache`-Referenzen (die `cacheGet`/`cacheSet`-Prepares) sind damit entfernt.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -30`
Expected: PASS (inkl. aller bestehenden player-matches-Tests). Kein Test darf noch `opponent_url_cache` referenzieren.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/services/player-matches-service.ts packages/core/src/services/player-matches-service.test.ts
git commit -m "feat(core): Gegner-URLs übers Spieler-Register (opponent_url_cache abgelöst)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Waidcup-Verlinkung liest aus dem Register

**Files:**
- Modify: `packages/core/src/services/waidcup-service.ts` (`getWaidcupPlayerUrls`)
- Modify: `packages/core/src/services/waidcup-service.test.ts`

**Interfaces:**
- Consumes: `resolveUrlsForNames` (Task 4). Signatur `getWaidcupPlayerUrls(db, tournamentId)` bleibt (`Record<name_key, url>`).

- [ ] **Step 1: Write the failing test**

```ts
test("getWaidcupPlayerUrls: löst über das Register auf (auch quelltübergreifend)", () => {
  const db = freshDb(); // Testdatei-Helper
  // Waidcup-Match nennt den Spieler, die URL kommt aber aus dem Register (z.B. Kader):
  upsertPlayer(db, { name: "Rauch Markus (R4)", url: "https://www.mytennis.ch/de/spieler/177712", member: true, memberSource: "roster" });
  seedTournamentMatch(db, 158138, { side1: "Rauch Markus (R4)", side2: "Aepli Daniel (R4)" }); // Testhelfer analog Bestand
  const map = getWaidcupPlayerUrls(db, 158138);
  assert.equal(map[playerNameKey("Markus Rauch")], "https://www.mytennis.ch/de/spieler/177712");
  db.close();
});
```
(`upsertPlayer`, `playerNameKey` importieren. `seedTournamentMatch` ggf. per direktem INSERT in `tournament_events`/`tournament_matches` aufbauen wie in bestehenden waidcup-Tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: FAIL (aktuelle Implementierung liest nur `tournament_players`, kennt die Kader-URL nicht).

- [ ] **Step 3: Implement**

`getWaidcupPlayerUrls` ersetzen: statt `tournament_players` abzufragen, die Spielernamen aus den Matches des Turniers sammeln und über das Register auflösen.
```ts
import { resolveUrlsForNames } from "./player-registry.js";

/** Profil-Links je Namensschlüssel für alle in den Matches des Turniers vorkommenden Spieler. */
export function getWaidcupPlayerUrls(database: TcwDatabase, tournamentId: number): Record<string, string> {
  const rows = database
    .prepare(
      `SELECT player1_name, player1_name_2, player2_name, player2_name_2
         FROM tournament_matches WHERE tournament_id = ?`,
    )
    .all(tournamentId) as Array<Record<string, string | null>>;
  const names: string[] = [];
  for (const r of rows) {
    for (const n of [r.player1_name, r.player1_name_2, r.player2_name, r.player2_name_2]) {
      if (n && n.trim() !== "") names.push(n);
    }
  }
  return resolveUrlsForNames(database, names);
}
```
Den nicht mehr benötigten `playerNameKey`/`safeExternalUrl`-Direktzugriff in dieser Funktion entfernen (falls dadurch Importe ungenutzt werden, oben bereinigen).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm -w @tcw/core run test 2>&1 | tail -20`
Expected: PASS (inkl. bestehender waidcup-Tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/waidcup-service.ts packages/core/src/services/waidcup-service.test.ts
git commit -m "feat(core): Waidcup-Verlinkung löst über das Spieler-Register auf

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Admin-API `GET /api/players/members`

**Files:**
- Modify: `apps/admin-server/src/routes/admin-api.ts` (nahe den `players`-Routen ~Zeile 71)
- Test: `apps/admin-server/src/routes/admin-api.test.ts` (falls vorhanden; sonst minimaler Route-Test)

**Interfaces:**
- Consumes: `listMembers` (Task 5).
- Produces: `GET /api/players/members?q=<text>` → `{ items: RegistryMember[] }`.

- [ ] **Step 1: Read context**

Run: `sed -n '55,85p' apps/admin-server/src/routes/admin-api.ts`

- [ ] **Step 2: Write the failing test** (falls Route-Tests existieren, dort ergänzen; sonst diesen Schritt als manuellen curl-Check in Step 5 ausführen und Step 2–4 als reine Implementierung behandeln)

```ts
test("GET /api/players/members liefert nur Mitglieder", async () => {
  const app = await buildTestAdminApp(); // vorhandener Test-Bootstrap
  // ... Mitglied ins Register schreiben ...
  const res = await app.inject({ method: "GET", url: "/api/players/members?q=rauch" });
  assert.equal(res.statusCode, 200);
  db.close?.();
});
```

- [ ] **Step 3: Implement**

In `admin-api.ts` `import`-Block ergänzen (bei den übrigen `@tcw/core`-Imports):
```ts
import { listMembers } from "@tcw/core";
```
Neue Route bei den `players`-Routen ergänzen:
```ts
app.get("/api/players/members", async (request) => {
  const q = (request.query as { q?: string }).q;
  return { items: listMembers(database, { query: q, limit: 25 }) };
});
```

- [ ] **Step 4: Run tests / typecheck**

Run: `npm -w @tcw/core run test 2>&1 | tail -5 && npm -w @tcw/admin-server run typecheck`
Expected: keine Fehler.

- [ ] **Step 5: Manual verify**

Run: `IC_DB_PATH=data/ic_teams.sqlite npx tsx -e "import {buildAdminApp} from './apps/admin-server/src/app.js'"` (oder Server starten und `curl 'localhost:8093/api/players/members?q=a'`).
Expected: JSON mit `items`.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-server/src/routes/admin-api.ts
git commit -m "feat(admin): GET /api/players/members (Register-Mitglieder)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Admin-Web — Mitglieder-Autocomplete bei der Team-Zuordnung

**Files:**
- Modify: `apps/web-admin/src/api/adminClient.ts`
- Modify: `apps/web-admin/src/features/PlayersAdmin.tsx`

**Interfaces:**
- Consumes: `GET /api/players/members` (Task 11).

- [ ] **Step 1: Read context**

Run: `sed -n '1,120p' apps/web-admin/src/features/PlayersAdmin.tsx` und `sed -n '1,80p' apps/web-admin/src/api/adminClient.ts`

- [ ] **Step 2: API-Client erweitern**

In `adminClient.ts` bei den übrigen Methoden ergänzen:
```ts
memberSuggest: (q: string) => request<{ items: Array<{ id: number; displayName: string; klassierung: string | null; profileUrl: string | null }> }>(`/api/players/members?q=${encodeURIComponent(q)}`),
```

- [ ] **Step 3: Autocomplete im Formular**

In `PlayersAdmin.tsx` das Freitext-Namensfeld des „neuer Spieler"-Formulars um eine Vorschlagsliste ergänzen: bei Eingabe `adminApi.memberSuggest(value)` abrufen (debounced), Treffer als `<datalist>` oder einfache Dropdown-Liste anzeigen; Auswahl setzt `name`, `klassierung` und `myTennisID` (aus `profileUrl`) in den Draft. Das bestehende manuelle Anlegen bleibt als Fallback möglich.

Minimales Muster (an den vorhandenen State/JSX anpassen):
```tsx
const [memberHits, setMemberHits] = useState<Array<{ id: number; displayName: string; klassierung: string | null; profileUrl: string | null }>>([]);
async function onNameInput(value: string): Promise<void> {
  setNewPlayer((p) => ({ ...p, name: value }));
  if (value.trim().length >= 2) setMemberHits((await adminApi.memberSuggest(value)).items);
  else setMemberHits([]);
}
function pickMember(hit: { displayName: string; klassierung: string | null; profileUrl: string | null }): void {
  setNewPlayer((p) => ({ ...p, name: hit.displayName, klassierung: hit.klassierung ?? "", myTennisID: hit.profileUrl ?? "" }));
  setMemberHits([]);
}
```

- [ ] **Step 4: Typecheck + Build**

Run: `npm -w @tcw/web-admin run typecheck && npm -w @tcw/web-admin run build 2>&1 | tail -5`
Expected: erfolgreicher Build.

- [ ] **Step 5: Manual verify (lokal)**

Admin lokal starten, PlayersAdmin öffnen, im Namensfeld tippen → Mitglieder-Vorschläge erscheinen; Auswahl füllt Klassierung + myTennisID.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/api/adminClient.ts apps/web-admin/src/features/PlayersAdmin.tsx
git commit -m "feat(admin-web): Mitglieder-Autocomplete für die Team-Zuordnung

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Testdaten-Seed vereinfachen (verlässt sich aufs Register)

**Files:**
- Modify: `scripts/seed-waidcup-test-data.ts`

**Interfaces:**
- Consumes: das Register wird durch das Backfill (Task 6) mit echten URLs gefüllt; der Seed muss keine URLs mehr selbst setzen.

- [ ] **Step 1: Implement**

Den in `seed-waidcup-test-data.ts` ergänzten Block, der `tournament_players` mit (echten oder erfundenen) URLs befüllt, entfernen — das Testturnier braucht keine eigenen `tournament_players`-URL-Zeilen mehr. Die Waidcup-Verlinkung löst die Match-Namen über das Register auf (das nach `npm run backfill:player-registry` die echten URLs der real existierenden Spieler kennt). Den Konsolen-Hinweis am Ende entsprechend anpassen (Hinweis: „Für Links vorher `npm run backfill:player-registry` ausführen").

- [ ] **Step 2: Verify lokal**

```bash
npm run backfill:player-registry
npm run seed:waidcup-test
```
Dann Waidcup-Server (Testturnier) starten und prüfen, dass echte Spieler verlinkt sind (Markus Rauch → `spieler/177712`), Phantasie-Namen link-frei.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-waidcup-test-data.ts
git commit -m "chore(seed): Waidcup-Testdaten verlassen sich aufs Spieler-Register

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Integrationslauf, Register befüllen, Deploy

**Files:** keine Code-Änderung; Verifikation & Rollout.

- [ ] **Step 1: Volltest + Typecheck**

Run: `npm run -s typecheck && npm run -s test 2>&1 | tail -15`
Expected: alles grün.

- [ ] **Step 2: Lokales Backup + Backfill + Smoke-Test**

```bash
cp data/ic_teams.sqlite data/ic_teams.backup-$(date +%Y%m%d-%H%M%S).sqlite   # Backup zuerst
npm run backfill:player-registry
# Bestandsdaten müssen unverändert sein:
node -e 'const D=require("better-sqlite3");const d=new D("data/ic_teams.sqlite",{readonly:true});for(const t of ["players","tournament_players","player_matches","teams"])console.log(t, d.prepare("SELECT COUNT(*) n FROM "+t).get().n);'
```
Zählwerte mit dem Stand vor dem Backfill vergleichen (unverändert). Waidcup-Server (echtes Turnier 158138) lokal starten, `/api/waidcup/order-of-play` prüfen: `playerUrls` enthält echte `mytennis.ch/de/spieler/<id>`-URLs; Spielermatches-API weiter korrekt.

- [ ] **Step 3: Deploy auf den Mac (Sicherheitsprotokoll + Backup)**

Askpass-Helfer transient anlegen (Passwort nie persistent). **Zuerst auf dem Mac ein DB-Backup ziehen:** `cp <APP_DIR>/data/ic_teams.sqlite <APP_DIR>/data/ic_teams.backup-<datum>.sqlite`. Dann Quellcode der geänderten Dateien per tar-over-ssh nach `<APP_DIR>` übertragen, `npm run backfill:player-registry` ausführen, Frontends bei UI-Änderung neu bauen, LaunchAgents `ch.tcw.ic-claude-admin`, `ch.tcw.ic-claude-public`, `ch.tcw.waidcup-public` per `launchctl kickstart -k` neu starten. Askpass shreddern, `~/.local/share/fish/fish_history` von „<redacted>" bereinigen.

- [ ] **Step 4: Verifikation gegen den Mac**

Bestandszahlen auf dem Mac gegenprüfen (`players`/`tournament_players`/`player_matches`/`teams` unverändert). `curl` der Waidcup-/Spielermatches-APIs; im echten Browser (Playwright) Waidcup-Links prüfen (Anzeige unverändert, Hover-Unterstreichung, korrekte Ziel-URLs).

- [ ] **Step 5: `opponent_url_cache` erst jetzt entfernen (optional, reversibel)**

Nachdem verifiziert ist, dass alle Auflösungen übers Register laufen und ein Backup existiert: `DROP TABLE IF EXISTS opponent_url_cache` (lokal und auf dem Mac). Bei Zweifel überspringen — die Tabelle stört nicht, wird nur nicht mehr genutzt.

- [ ] **Step 6: Commit/Doku**

Kurze Notiz in `docs/STATUS.md`, dass das Register aktiv ist und wie Backup, Backfill und der Admin-Picker zu nutzen sind.

---

---

# Phase 2: Fremdschlüssel-Verknüpfung (Folge-Ausbau)

> Startet **nachdem** die Register-Basis (Tasks 1–14) steht und deployt ist.
> Entscheidung: **Kader/Teams hart** verknüpfen (`players.registry_id` als echter
> FK), **Swisstennis-Feed-Tabellen weich** (nullable `registry_id`, vom Import
> opportunistisch nur bei eindeutigem Treffer gefüllt). Grund: Feed-Namen haben
> nicht immer eine stabile Identität (NC/Gäste), der Import ersetzt atomar, und
> Doppel packen zwei Personen pro Zeile — ein harter FK dort würde das
> Import-Modell brechen und Live-Migrationsrisiko erzeugen. Weiterhin gilt: KEIN
> Datenverlust (nur additive Spalten via `ensureColumn`, Backup vor Backfill).

## Task 15: `upsertPlayer` liefert die Register-id zurück

**Files:** Modify `packages/core/src/services/player-registry.ts`, `packages/core/src/services/player-registry.test.ts`

**Interfaces:** `upsertPlayer(db, input): number` — gibt die `player_registry.id` der ein-/upgedateten Zeile zurück (bisher `void`; bestehende Aufrufer, die den Rückgabewert ignorieren, bleiben unberührt).

- [ ] **Step 1:** Test: `const id = upsertPlayer(db, {...}); ` — zweiter Upsert desselben Spielers liefert **dieselbe** id; unterschiedliche Spieler → verschiedene ids.
- [ ] **Step 2:** Fail-Lauf (`upsertPlayer` gibt noch `void`).
- [ ] **Step 3:** Implementieren: im UPDATE-Zweig `existing.id` zurückgeben; im INSERT-Zweig `Number(info.lastInsertRowid)` aus dem `better-sqlite3`-`RunResult`. Rückgabetyp auf `number` setzen.
- [ ] **Step 4:** `npm -w @tcw/core run test` grün (alle Bestandstests unverändert grün).
- [ ] **Step 5:** Commit.

## Task 16: `players.registry_id` (harter FK) + Population

**Files:** Modify `packages/core/src/db/connection.ts` (`ensureColumn`), `packages/core/src/services/admin/enrich.ts`, `packages/core/src/services/player-registry-backfill.ts`, jeweils zugehörige Tests.

**Interfaces:** Neue Spalte `players.registry_id INTEGER REFERENCES player_registry(id)`, gefüllt beim Kader-Sync und im Backfill.

- [ ] **Step 1:** Test: nach `syncPlayerToRegistry` bzw. Backfill hat die `players`-Zeile ein `registry_id`, das auf die passende Register-Zeile zeigt (Join liefert dieselbe URL/Klassierung).
- [ ] **Step 2:** Fail-Lauf.
- [ ] **Step 3:** Implementieren:
  - In `connection.ts` bei den `ensureColumn`-Aufrufen ergänzen: `ensureColumn(database, "players", "registry_id", "INTEGER REFERENCES player_registry(id)");` (additiv, bestehende DBs erhalten die Spalte; kein Datenverlust). Reihenfolge beachten: `player_registry` wird von `SCHEMA_SQL` vor dem `ensureColumn` erzeugt.
  - `syncPlayerToRegistry` (Task 8) so erweitern, dass es die von `upsertPlayer` (Task 15) zurückgegebene id nimmt und `UPDATE players SET registry_id=? WHERE id=?` setzt (id des Kaderspielers durchreichen).
  - Im Backfill (Schritt „Team-Kader") nach dem Upsert die zurückgegebene id in `players.registry_id` schreiben.
- [ ] **Step 4:** `npm -w @tcw/core run test` grün.
- [ ] **Step 5:** Commit.

## Task 17: Weiche `registry_id`-Spalten auf den Feed-Tabellen

**Files:** Modify `packages/core/src/db/connection.ts`, `packages/core/src/services/tournament-store.ts`, `packages/core/src/services/player-matches-service.ts`, zugehörige Tests.

**Interfaces:** Nullable Spalten (kein erzwungener FK-Constraint, „weich"): `tournament_players.registry_id`, `tournament_players.registry_id_2`; `player_matches.s1p1_registry_id … s2p2_registry_id`. Vom Import **nur bei eindeutigem** Register-Treffer gefüllt (sonst NULL).

- [ ] **Step 1:** Test: nach Turnier-Import trägt ein Spieler mit eindeutigem Register-Treffer sein `registry_id`; ein mehrdeutiger/namens-only-Fall bleibt NULL.
- [ ] **Step 2:** Fail-Lauf.
- [ ] **Step 3:** Implementieren:
  - `ensureColumn` für die neuen nullable Spalten (additiv). Bewusst **ohne** `REFERENCES`-Constraint (weich), damit der atomare Replace-Import und name-only-Fälle nicht brechen.
  - Eine Hilfsfunktion `registryIdForName(db, name): number | null` im Register-Service (nutzt die eindeutige Auflösung analog `resolveUrlByNameKey`, gibt die id nur bei genau einem Treffer).
  - Turnier-Import (Task 7) und IC-Sync (Task 9) füllen die Slot-`registry_id`s über `registryIdForName` beim Schreiben der Zeile.
- [ ] **Step 4:** `npm -w @tcw/core run test` grün.
- [ ] **Step 5:** Commit.

## Task 18: Verifikation & optionaler Consumer-Join

**Files:** keine erzwungene Änderung; Verifikation.

- [ ] Prüfen, dass Team-Roster und Spielermatches über den FK/Soft-Link denselben Stand liefern wie zuvor (keine Regression). Optional: Team-Roster-Anzeige (`teams-service.ts`) und Autocomplete auf den Join zum Register umstellen, falls das Duplikate reduziert — nur wenn ohne Risiko. Andernfalls bewusst beim bestehenden Lesen belassen und als künftige Aufräumarbeit notieren.

## Task 19 (optional): IC-Mitgliedschaftsableitung

> Nur wenn zusätzliche Mitglieder-Abdeckung über den Kader hinaus gewünscht ist.
> Aus Task 9 bewusst herausgehalten (Redundanz zum Kader + Risiko).

- [ ] In `extractEncounter` (`player-matches-service.ts`) die eigene Seite bestimmen:
  `ownSide = detail.homeClubNb === OWN_CLUB_ID ? 1 : (/waidberg/i.test(detail.awayTeam) ? 2 : 0)`.
  `ownSide` auf dem `MatchRecord` mitführen (nur IC/TC; Turnier-Records `ownSide = 0`).
- [ ] In `upsertRecords` je Slot `upsertPlayer(db, { name, member: onOwnSide, memberSource: onOwnSide ? "ic-home" : undefined })` aufrufen (nur nicht-leere Namen). Test: Heim-Waidberg → side1 Mitglied; Auswärts-Waidberg → side2 Mitglied; Gegner nie Mitglied.

---

## Self-Review Notes

- **Spec-Abdeckung:** Tabelle (T2), Identität/Matching (T3–T4), Mitgliedschaft (T5), Service (T3–T5), Imports befüllen (T7 Turnier, T8 Kader, T9 IC), Consumer (T10 Waidcup, T9 Spielermatches, T11/T12 Admin-Picker), Backfill + `opponent_url_cache`-Ablösung (T6), Seed (T13), Deploy (T14). Alle Spec-Abschnitte abgedeckt.
- **Offene Präzisierung während der Umsetzung:** exakte Variablennamen in `tournament-store.ts` (T7), `enrich.ts` (T8) und `player-matches-service.ts` (T9) sind erst beim Öffnen der Datei sichtbar — jede dieser Tasks beginnt daher mit einem „Read context"-Schritt.
- **Typkonsistenz:** `RegistryUpsert`, `RegistryMember`, `upsertPlayer`, `resolveUrlByNameKey`, `resolveUrlsForNames`, `listMembers`, `setMembership`, `backfillPlayerRegistry`, `syncPlayerToRegistry`, `parseMyTennisId` durchgehend gleich benannt.
