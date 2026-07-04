# Phase 3 — Klassierung zentral & Redundanz raus · Implementation Plan

> Subagent-getrieben ausführen. Reihenfolge zwingend: **erst alle Leser/Schreiber
> aufs Register umbiegen, DANN Spalten droppen.** Branch bleibt bis zum letzten
> Schritt jederzeit grün & deploybar.

**Goal:** `player_registry` = einzige Wahrheit für Identität + aktuelle Klassierung.
`players.klassierung`, `players.myTennisID`, `tournament_players.ranking(_2)` werden
entfernt; Klassierung zentral über den (umgebogenen) Admin-Button aktualisiert;
Admin pflegt nur die numerische mytennis-ID.

Spec: `docs/superpowers/specs/2026-07-04-klassierung-normalisierung-design.md`

## Global Constraints
- **KEIN Datenverlust:** Backup existiert (`ic_teams.rollback-pre-phase3-*`). Vor dem
  Spalten-Drop müssen die Werte nachweislich im Register liegen (Verifikation).
- **Admin = nur TCW-Mitglieder:** create/update setzt `is_tcw_member=1` (`roster`);
  Team-Zuordnung nur via `listMembers`. Darf nicht brechen.
- **Feed-Tabellen behalten den Namen** (Robustheit; Nicht-Mitglieder/Gegner).
- Deutschsprachige Doc-Kommentare; Commit-Footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Klassierung/URL werden IMMER über `players.registry_id` (harter FK) bzw. für
  Turnier-Anzeige über `tournament_players.registry_id` (weich) aufgelöst.

## Reihenfolge & Tasks

### Task 1 — Shared `myTennisUrlFromId`
Umkehr von `parseMyTennisId`: `myTennisUrlFromId(id: string|number|null): string | null`
→ `https://www.mytennis.ch/de/spieler/<id>` nur für rein-numerische IDs, sonst null.
In `packages/shared/src/domain/mytennis-id.ts` + Re-Export. TDD.

### Task 2 — Klassierungs-Update aufs Register
`updateKlassierungenFromMyTennis` (`admin/enrich.ts`): liest künftig Register-Einträge
mit `profile_url` (statt `players`), sucht MyTennis, aktualisiert
`player_registry.klassierung`, loggt in `ranking_changes` (player_id = registry-id,
player_name = display_name, myTennisID = profile_url). `players` bleibt unberührt.
Admin-Route bleibt gleich. TDD (in-memory: Register mit profile_url → Update setzt
klassierung + Log; ohne Netz durch Aufteilen in eine testbare „apply"-Teilfunktion,
Netz-Suche als Parameter/Fallback).

### Task 3a — Öffentliche Team-Anzeige aus dem Register
`teams-service.getPublicTeams`: `... FROM players p LEFT JOIN player_registry r ON
r.id = p.registry_id` → `klassierung`, `profile_url` aus `r`. DTO `myTennisUrl`/
`klassierung` unverändert befüllt. TDD (Team + player mit registry_id → klassierung/URL
aus Register).

### Task 3b — Admin-Roster + Spielermatches-Leser
- `admin/players-admin.listPlayers`: JOIN `player_registry` → klassierung, mytennis-ID
  (numerisch) fürs Frontend.
- `player-matches-service.applyOwnUrls` + `suggestPlayers`: URL/Klassierung aus dem
  Register (via name_key / registry) statt `players.myTennisID`/`klassierung`.
TDD je Funktion.

### Task 3c — Turnier-Registrierungsanzeige
`tournament-store` (`toRegistrationPlayer`/`loadTournamentEvents`): Klassierung der
Registrierung aus dem Register (via `registry_id`/name_key), nicht aus
`tournament_players.ranking`. TDD.

### Task 4 — Schreiber: gedroppte Spalten nicht mehr schreiben
- `enrich.enrichPlayer`: `UPDATE players SET klassierung, myTennisID` entfernen;
  Klassierung/URL nur ins Register (bereits via `syncPlayerToRegistry`), `players.registry_id`
  via `linkPlayerRegistryId` bleibt.
- `admin/players-admin.createPlayer`/`updatePlayer`: `players`-INSERT/UPDATE ohne
  `klassierung`/`myTennisID`; Werte aus dem Input gehen ins Register
  (`mirrorRosterPlayer` nimmt Input statt `players`-Zeile). `is_tcw_member=1` bleibt.
- `tournament-store`: `tournament_players`-INSERT ohne `ranking`/`ranking_2` (Register
  bekommt Klassierung wie bisher über `upsertPlayer`).
- `player-registry-backfill`: roster-SELECT ohne `klassierung`/`myTennisID` (nach Drop).
TDD/Anpassung bestehender Tests.

### Task 5 — Admin pflegt numerische mytennis-ID
- `shared/types.ts`: Player-DTOs führen `mytennisId` (numerisch) statt/zusätzlich zur URL.
- `web-admin/PlayersAdmin` + `adminClient`: Feld „mytennis-ID" (numerisch); Backend baut
  URL via `myTennisUrlFromId` → Register. Autocomplete (`pickMember`) füllt die ID
  (aus `profileUrl` via `parseMyTennisId`). Link wird aus der ID rekonstruiert.
- Backend `createPlayer`/`updatePlayer`/`PlayerInput`: nimmt `mytennisId`, baut URL,
  schreibt Register. Verify: typecheck + build.

### Task 6 — Spalten droppen (Migration, mit Verifikation)
Nach Tasks 1–5 (alle Leser/Schreiber umgebogen):
- Verifikation: für jede `players`-Zeile mit `registry_id` liegt klassierung/URL im
  Register; für `tournament_players` liegt klassierung im Register (oder war leer).
- `ALTER TABLE players DROP COLUMN klassierung; DROP COLUMN myTennisID;`
- `ALTER TABLE tournament_players DROP COLUMN ranking; DROP COLUMN ranking_2;`
  (via einmaliges Migrations-Script `scripts/drop-redundant-columns.ts`, idempotent:
  prüft `PRAGMA table_info` vor dem Drop; Backup-Hinweis.)
- `SCHEMA_SQL` bereinigen (die Spalten aus den CREATE-Statements entfernen), damit
  frische DBs sie gar nicht erst anlegen.
TDD: nach Drop existieren die Spalten nicht mehr; Volltest grün.

### Task 7 — Volltest, Verifikation & Deploy
- `npm run typecheck && npm run test` grün; alle Frontends bauen.
- Lokal: Migration + Smoke-Test (Team-Anzeige, Admin-Roster, Waidcup, Klassierungs-Update).
- Deploy Mac: (Backup existiert) Sync, Migrations-Script, Frontends bauen, Dienste neu
  starten, Smoke-Test (öffentliche Team-Seite 8092, Admin 8093, Waidcup 8096). Askpass-Protokoll.

## Self-Review Notes
- Reihenfolge sichert: kein Fenster, in dem ein Leser eine gedroppte Spalte liest.
- Rollback: DB-Backup `ic_teams.rollback-pre-phase3-*` (lokal + Mac + off-box); Code
  `main @ 40bb0d8`.
- Risiko-Schwerpunkt: `teams-service` (öffentliche Seite) und der Spalten-Drop —
  beide mit eigenem Test + Smoke-Check.
