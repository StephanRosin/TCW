# Phase 3: Klassierung zentral & Redundanz raus

**Datum:** 2026-07-04
**Status:** Design (2 Entscheidungen getroffen) — Plan/Umsetzung folgt

## Problem

Nach Einführung des `player_registry` (Phase 1/2) sind Name/Klassierung/URL/Lizenz
weiterhin redundant in mehreren Tabellen gespeichert, obwohl `registry_id` bereits
verknüpft. Der Nutzer stellt fest: das widerspricht der Normalisierung.

Fachliche Klärung durch den Nutzer:
- **Name + Lizenznummer sind unveränderlich** → gehören in *eine* Quelle (Register).
- **Klassierung ist das Einzige, das sich ändert** → zentral im Register, halbjährlich
  aktualisiert (Swisstennis publiziert 2×/Jahr).

## Ziel

`player_registry` ist die **einzige Wahrheit** für Identität (Name, Lizenz) und die
**aktuelle Klassierung**. Echte redundante Kopien werden entfernt; die Klassierung
wird zentral über einen (umgebogenen) manuellen Admin-Lauf aktualisiert.

## Entscheidungen (vom Nutzer)

- **D2 — `tournament_players.ranking`/`ranking_2`:** ENTFERNEN. Anzeige nimmt überall
  die aktuelle `player_registry.klassierung` (über `registry_id`). Kein Snapshot mehr.
- **D3 — Update-Mechanik:** MANUELLER Admin-Button („Klassierungen aktualisieren"),
  künftig auf das Register gerichtet. Kein Hintergrund-Job.

## Harte Invarianten (dürfen NICHT brechen)

1. **Kein Datenverlust:** Vor jedem Spalten-Drop Backup; Werte müssen vorher
   nachweislich im Register liegen (Verifikation).
2. **Admin = nur TCW-Mitglieder:** Der Roster-Admin verwaltet ausschließlich
   Mitglieder. Jeder neu angelegte/bearbeitete Spieler bekommt `is_tcw_member = 1`
   (`member_source = roster`). Team-Zuordnung zieht nur aus `listMembers`.
3. **Robustheit der Feed-Tabellen:** `tournament_players`/`player_matches` behalten
   den **Namen** (enthalten auch Nicht-Mitglieder/Gegner; Swisstennis-Schreibweisen).
   Nur die Klassierung/URL werden zentralisiert.

## Was bleibt (bewusst, keine Redundanz)

- `player_matches.s*_name`, `tournament_players.player_name` — Namen aus dem Feed
  (Robustheit, auch Nicht-Mitglieder).
- `tournament_players.license_number(_2)` — liegt nur hier + im Register (kein
  Verteilungsproblem; Quelle = Swisstennis-Anmeldung).
- `ranking_changes.*` — Änderungs-Log (eigene Historie, bleibt).

## Was entfernt wird (echte Redundanz)

- `players.klassierung`, `players.myTennisID` — kommen künftig aus dem Register
  (Join über `players.registry_id`, hart, immer gesetzt).
- `tournament_players.ranking`, `tournament_players.ranking_2` (D2).

## Änderungen (Consumer aufs Register umbiegen, dann Spalten droppen)

**Klassierungs-Update (Kern):** `updateKlassierungenFromMyTennis` liest künftig die
Register-Einträge mit `profile_url`, aktualisiert `player_registry.klassierung`
(statt `players.klassierung`), loggt weiter in `ranking_changes`. Bleibt der
manuelle Admin-Button.

**Leser umbiegen (Klassierung/URL aus dem Register via `registry_id`-Join):**
- `teams-service.getPublicTeams` (öffentliche Team-Anzeige) — JOIN `player_registry`.
- `player-matches-service.applyOwnUrls` + `suggestPlayers` — Register statt `players`.
- `admin/players-admin.listPlayers` (Roster-Tabelle) — JOIN `player_registry`.
- `tournament-store` Registrierungs-Anzeige (`toRegistrationPlayer`) — Klassierung aus
  Register; `ranking` nicht mehr aus `tournament_players`.

**Schreiber umbiegen:**
- `admin/enrich.enrichPlayer` — schreibt Klassierung/URL nur noch ins Register
  (nicht mehr in `players`-Spalten).
- `admin/players-admin.createPlayer`/`updatePlayer` — Klassierung/URL aus dem
  Formular gehen ins Register (via `syncPlayerToRegistry`), nicht in `players`-Spalten;
  `mirrorRosterPlayer` nimmt die Werte aus dem Input, nicht aus der `players`-Zeile.
  Invariante 2 bleibt (member:true roster).
- `tournament-store` — schreibt `tournament_players.ranking` nicht mehr (Register
  bekommt die Klassierung wie bisher über `upsertPlayer`).

**Migration (nach Umbiegen aller Leser, mit Backup + Verifikation):**
DROP COLUMN `players.klassierung`, `players.myTennisID`,
`tournament_players.ranking`, `tournament_players.ranking_2` (SQLite ≥ 3.35).

**Typen/Frontend:**
- `packages/shared/src/types.ts` (TeamPlayer/PlayerRow) — `klassierung`/`myTennisUrl`
  bleiben im DTO (jetzt aus dem Register befüllt), nicht mehr aus der `players`-Spalte.
- `apps/web-admin` PlayersAdmin — Formular sammelt Klassierung/URL weiter, Werte
  landen im Register; Roster-Tabelle zeigt Register-Werte.

## Zusatz — Admin pflegt nur die mytennis-ID (nicht die URL)

Die Profil-URL ist immer `https://www.mytennis.ch/de/spieler/<id>`; nur die
numerische ID variiert. Im Admin wird künftig **nur die ID** gepflegt.

- Neuer Shared-Helfer `myTennisUrlFromId(id): string | null` (Umkehr von
  `parseMyTennisId`; baut die URL nur für gültige numerische IDs).
- Admin-Formular (`web-admin/PlayersAdmin`): Feld „myTennisID (URL)" → **„mytennis-ID"**
  (numerisch). Eingabe-ID → Backend baut die URL → Register (`mytennis_id` +
  `profile_url`). Anzeige/Autocomplete zeigen/liefern die ID; der Link wird aus der
  ID rekonstruiert.
- `player_registry.mytennis_id` ist bereits vorhanden und wird der geführte Wert;
  `profile_url` bleibt (abgeleitet) für den Link.

## Tests / Verifikation

- Klassierungs-Update: aktualisiert `player_registry.klassierung`, loggt Änderung;
  `players` unberührt.
- teams-service/listPlayers/suggest liefern Klassierung/URL aus dem Register (Join).
- create/update/enrich: setzen Klassierung/URL im Register + `is_tcw_member=1`;
  keine Referenz mehr auf gedroppte Spalten.
- Nach Drop: Volltest grün, Build grün, Bestandszahlen unverändert; öffentliche
  Team-Anzeige + Admin-Roster + Waidcup unverändert korrekt.
- Deploy: Backup, Sync, Migration (Drop via ensureColumn-Pendant/Script), Neustart,
  Smoke-Test gegen den Mac; Askpass-Protokoll.

## Risiko

Höher als Phase 1/2: Spalten-Drop an Live-Tabellen + öffentliche Team-Anzeige
betroffen. Mitigation: alle Leser zuerst umbiegen und testen, Drop erst danach,
Backup + Zeilen-/Wert-Verifikation, gestaffeltes Deploy.
