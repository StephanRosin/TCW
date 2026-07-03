# Zentrales Spieler-Register (player_registry)

**Datum:** 2026-07-03
**Status:** Design freigegeben, Implementierungsplan ausstehend

## Problem

Spieler-Identität und mytennis.ch-Profil-URLs sind über vier Tabellen verstreut,
die nur per normalisiertem Namensschlüssel (`playerNameKey`) lose zusammenhängen:

| Tabelle | Namensspalte(n) | URL-Spalte(n) | Stabile ID | Quelle |
|---|---|---|---|---|
| `players` | `name` | `myTennisID` (volle URL) | — | Interclub-Team-Kader (manuell + enrich) |
| `tournament_players` | `player_name(_2)` | `player_url(_2)` | `license_number(_2)` | Swisstennis-Turnier-Anmeldungen |
| `player_matches` | `s*p*_name` | `s*p*_url` | — | Interclub-/Turnier-Begegnungen |
| `opponent_url_cache` | (nur `name_key`) | `url` | — | Gegner-URL-Auflösung (Cache) |

Folgen:
- Eine Verlinkung (z. B. Waidcup "Order of Play") sieht nur *eine* Quelle und
  verpasst URLs, die in einer anderen Tabelle längst vorhanden sind
  (konkret aufgetreten: „Markus Rauch" wurde nicht/falsch verlinkt).
- Es gibt **keine kanonische „TCW-Spieler"-Entität**. Membership ist nur implizit
  (= steht im `players`-Kader). Für das Admin-Panel wird aber eine explizite
  Mitgliederliste gebraucht: **nur TCW-Mitglieder sollen der Team-Zuordnung zur
  Verfügung stehen.**

## Ziel

Ein zentrales `player_registry` als kanonische Quelle für Spieler-Identität,
Profil-URL, Klassierung und **Mitgliedschaft**. Alle Imports befüllen es per
UPSERT; alle Verlinkungen/Auflösungen und der Admin-Team-Picker lesen daraus.
Bestehende Feature-Tabellen bleiben (Option A – kein Voll-Umbau auf
Fremdschlüssel), lösen Identität/URL aber über das Register auf.

## Nicht-Ziele (YAGNI)

- Kein Umbau von `players`/`tournament_players`/`player_matches` auf
  Fremdschlüssel zum Register (kein „Voll-Umbau").
- Kein neuer Swisstennis-Klub-Roster-Import (existiert nicht; Daten geben eine
  vollautomatische „alle Waidberg-Mitglieder"-Liste nicht her).
- Keine Änderung an der öffentlichen Team-/Turnier-Darstellung über das hinaus,
  was die zentrale URL-Auflösung ohnehin verbessert.

## Datenmodell

### Neue Tabelle `player_registry`

| Spalte | Typ | Zweck |
|---|---|---|
| `id` | INTEGER PK | Surrogatschlüssel |
| `mytennis_id` | TEXT UNIQUE NULL | Numerische ID aus der Profil-URL geparst — **kanonische Identität**, wenn bekannt |
| `name_key` | TEXT NOT NULL | `playerNameKey` — Matcher für Namens-only-Lookups |
| `display_name` | TEXT NOT NULL | Lesbarer Name (beste bekannte Schreibweise) |
| `profile_url` | TEXT NULL | Volle mytennis-URL (aus `mytennis_id` ableitbar) |
| `klassierung` | TEXT NULL | Aktuellste bekannte Klassierung |
| `license_number` | TEXT NULL | Swisstennis-Lizenz (aus `tournament_players`), zweite stabile ID |
| `is_tcw_member` | INTEGER NOT NULL DEFAULT 0 | 0/1 |
| `member_source` | TEXT NULL | `roster` / `ic-home` / `admin` — Herkunft des Flags |
| `updated_at` | TEXT NOT NULL | ISO-Zeitstempel |

Indizes: `UNIQUE(mytennis_id)` (wo nicht NULL), `INDEX(name_key)`,
`INDEX(is_tcw_member)`.

### Identität & Matching (mytennis-ID-first)

- **Quelle mit URL:** ID aus der URL parsen (`.../spieler/<id>` bzw.
  `.../player/<id>`) → UPSERT per `mytennis_id` (autoritativer Merge). Dabei
  `name_key`, `display_name`, `klassierung`, `license_number` aktualisieren.
- **Quelle nur mit Name** (Turnier-Matchname, Gegnername): Match per `name_key`.
- **Mehrdeutiger `name_key`** (zwei echte Personen, gleicher normalisierter Name,
  unterschiedliche `mytennis_id`): **nicht raten.** Ein Namens-only-Lookup auf
  einen mehrdeutigen Schlüssel liefert **keinen** Treffer (lieber kein Link als
  ein falscher) und wird geloggt.

### Mitgliedschaft (`is_tcw_member`)

Auf `1` gesetzt, wenn eine der Bedingungen zutrifft:
1. Migriert aus heutigem `players`-Kader (`member_source = roster`).
2. Heim-Seite (`clubNb == OWN_CLUB_ID = 1298`) einer Interclub-Begegnung
   (`member_source = ic-home`).
3. Admin-Toggle (`member_source = admin`).

Regeln:
- Default `0` für Turnier-Teilnehmer und Gegner (extern), außer sie matchen per
  `mytennis_id`/`name_key` eine bestehende Mitglieds-Zeile.
- **Imports degradieren nie** ein Mitglied auf `0`; nur der Admin kann das.
- `member_source = admin` ist stärkste Stufe und wird von Imports nicht
  überschrieben.

## Komponenten

### Service `player-registry.ts` (packages/core/src/services)

Klar abgegrenzte Schnittstelle, damit Imports und Consumer entkoppelt bleiben:

- `upsertFromUrl({ url, name, klassierung?, license?, member?, memberSource? })`
  — parst `mytennis_id`, merged per ID.
- `upsertNameOnly({ name, klassierung?, member?, memberSource? })`
  — Zeile ohne URL (per `name_key`); wird später durch eine URL-Quelle angereichert.
- `resolveUrlByNameKey(nameKey): string | null` — Namens-only-Auflösung inkl.
  Mehrdeutigkeits-Schutz.
- `resolveUrlsForNames(names: string[]): Record<nameKey, url>` — Bulk-Variante
  für Verlinkungen (ersetzt die heutige `getWaidcupPlayerUrls`-Logik).
- `listMembers({ query?, limit? }): RegistryPlayer[]` — für den Admin-Team-Picker.
- `setMembership(id, isMember): void` — Admin-Toggle (`member_source = admin`).

Ein Helper `parseMyTennisId(url)` (in `packages/shared` neben `safeExternalUrl`),
da URLs sowohl `/spieler/<id>` als auch `/player/<id>` sein können.

### Imports (befüllen das Register per UPSERT)

- **Team-Kader / enrich** (`admin/enrich.ts`, `players-admin.ts`):
  `upsertFromUrl(..., member: true, memberSource: "roster")` bei jedem Setzen von
  `myTennisID`.
- **Turnier-Anmeldungen** (`tournament-service.ts` / `tournament-store.ts`):
  `upsertFromUrl(..., license, member: false)` je Registrierung (beide
  Doppel-Spieler).
- **Interclub-Begegnungen** (`player-matches-service.ts` `syncPlayerMatches`):
  Heim-Seite `upsertFromUrl/NameOnly(..., member: true, memberSource: "ic-home")`,
  Auswärts non-member. Die bisherige Gegner-URL-Auflösung schreibt ins Register
  statt in `opponent_url_cache`.

### Consumer (lesen aus dem Register)

- `getWaidcupPlayerUrls` → `resolveUrlsForNames` (Waidcup-Verlinkung). Damit
  greift jede im Klub bekannte URL, egal aus welcher Quelle sie ursprünglich kam.
- Spielermatches `applyOwnUrls` / `resolveOpponentUrls` → Register.
- Admin-Team-Zuordnung (Autocomplete/Picker) → `listMembers`.

### Ablösung `opponent_url_cache`

`opponent_url_cache` ist bereits `name_key → url` und geht funktional im Register
auf. Der Cache-Lese-/Schreibpfad in `resolveOpponentUrls` wird auf das Register
umgestellt; die Tabelle wird nach erfolgreichem Backfill entfernt (Migration).

### `players`-Tabelle

Bleibt als Team-Zuordnungstabelle (`team_id`) unverändert. `myTennisID`/
`klassierung` werden weiterhin dort geführt, sind aber im Register gespiegelt.
(Ein späteres Ausdünnen zu einer reinen Verknüpfungstabelle ist bewusst
**nicht** Teil dieses Specs.)

## Migration / Backfill

Ein idempotentes Script `scripts/backfill-player-registry.ts`:

1. `players` → Register (`member = 1`, `roster`), URL/Klassierung.
2. `tournament_players` → Register (URL, Lizenz), non-member.
3. `player_matches`-Slots + `opponent_url_cache` → Register (URL), non-member.
4. Interclub-Heimspieler (aus `matches`/Encounter-Daten) → `member = 1`,
   `ic-home`, ohne bestehende `admin`-Flags zu überschreiben.

Dedup-Reihenfolge: erst `mytennis_id`, dann `name_key`. Beliebig wiederholbar.

**Datensicherheit:** Das Backfill liest nur aus den Bestandstabellen und schreibt
ausschließlich in `player_registry` — **keine** bestehende Anmeldung, kein
Kaderspieler, keine Team-Zuordnung wird verändert oder gelöscht. Vor jedem Lauf
auf einer echten DB wird die SQLite-Datei kopiert (Backup). `opponent_url_cache`
(reiner, regenerierbarer Cache) wird erst **nach** Backup und Verifikation
entfernt, nachdem seine Werte ins Register übernommen wurden.

Das Waidcup-Testdaten-Seed (`seed-waidcup-test-data.ts`) füllt keine erfundenen
URLs mehr, sondern verlässt sich auf das Register (das nach dem Backfill die
echten URLs der real existierenden Spieler kennt).

## Tests

- `player-registry`: UPSERT per `mytennis_id` merged korrekt; `name_key`-Lookup;
  Mehrdeutigkeits-Schutz (zwei IDs, gleicher `name_key` → kein Treffer);
  Membership-Regeln (Import degradiert nicht, `admin` gewinnt).
- `parseMyTennisId`: `/spieler/<id>`, `/player/<id>`, ungültig → null.
- Backfill: aus einer verstreuten Beispiel-DB entsteht ein konsistentes Register;
  idempotent (zweiter Lauf ändert nichts).
- Regressionen: `getWaidcupPlayerUrls`, Spielermatches-URL-Auflösung, Admin-
  `listMembers` liefern erwartete Ergebnisse aus dem Register.

## Auswirkungen / Risiken

- Reine Lese-Auflösung ändert sich (mehr Treffer) — positiv, aber Screenshot-/
  API-Verifikation für Waidcup-Links und Spielermatches nötig.
- Migration entfernt `opponent_url_cache` — nur nach erfolgreichem Backfill.
- Mac-Deployment: neues Schema (Migration) + Backfill-Script müssen dort laufen;
  Waidcup läuft via `tsx` aus dem Quellcode (kein Backend-Build nötig), Frontend
  nur falls UI-Teile (Admin-Picker) betroffen sind.
