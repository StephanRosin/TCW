# TCW Spielbetrieb 2026

Digitale Plattform für den Spielbetrieb des **TC Waidberg**: öffentliche
Vereins- und Interclub-Seite, ein internes Verwaltungswerkzeug und eine
eigenständige Turnier-Website für den **Waidcup** – inklusive begehbarem
3D-Rundgang der Anlage.

Das Projekt ist ein **npm-Monorepo** (TypeScript). Aus ihm werden mehrere
eigenständige Web-Apps gebaut, die sich Datenbank und Kernlogik teilen. Alle
Daten stammen aus offiziellen Quellen – **SwissTennis** (Spieltermine,
Resultate, Turniere), **MyTennis** (Spielerprofile) und **GotCourts**
(Platzbelegung) – und werden regelmässig automatisch importiert.

---

## Die Apps

### 1. Öffentliche Vereins-Website

> Frontend `apps/web-public` · Server `apps/public-server` · Port **8092** (live),
> **8090** (Default im Code)

Die öffentliche Seite des Vereins mit dem gesamten Interclub- und
Vereinsbetrieb. Was Besucher:innen hier finden:

- **Teams** – alle Interclub-Teams (Damen/Herren) mit Aufstellung, Klassierung,
  Captain und direkten Links zu den MyTennis-Profilen.
- **Trainingsplan** – Trainingszeiten je Wochentag auf einem Platzraster.
- **Interclub-Matches** – Spieltermine mit Resultaten, laufend aktualisiert.
- **Resultate & Team-Challenge** – Ergebnisse der Begegnungen.
- **Spielermatches** – die komplette Match­historie eines Spielers übers Jahr,
  über alle Wettbewerbe hinweg (Interclub, Team-Challenge, Turniere).
- **Klassierungen** – Klassierungsänderungen der Vereinsmitglieder.
- **Turniere** – Turnierübersicht inkl. Tableau/Turnierbaum.
- **Agenda** – Termine des Vereins.
- **Plätze** – Live-Platzbelegung (aus GotCourts) neben einem laufend
  aktualisierten Webcam-Standbild der Anlage.
- **Ticker** – ein clubweiter Ergebnis-Ticker der zuletzt gespielten Matches,
  mit „Mehr anzeigen" zum Nachladen.

Mehrsprachig (DE/EN/FR/IT) und mit mehreren Farb-Themes.

### 2. Adminbereich (intern)

> Frontend `apps/web-admin` · Server `apps/admin-server` · Port **8093** (live),
> **8091** (Default im Code)

Das interne Verwaltungswerkzeug (nur im LAN erreichbar). Damit pflegt der
Verein alle Inhalte der öffentlichen Seite:

- **Teams, Spieler, Klassierungen, Trainingsslots** (komfortables Bulk-Grid),
  **Turniere** und **Einstellungen** – jeweils mit voller CRUD-Bearbeitung.
- **Aktionen** – Importe und Abgleiche manuell anstossen.

Der Admin-Prozess führt zusätzlich die **Hintergrund-Jobs** aus: stündlicher
Import der SwissTennis-Spieltermine und -Resultate (ClubResult), Turnier-Polling
sowie der Abgleich von Klassierungen und Spielermatches – jeweils schonend mit
Zwischenspeicher und Jitter.

### 3. Waidcup-Turnier-Website

> Frontend `apps/waidcup-public` · Server `apps/waidcup-server` · Port **8096**

Eine komplett eigenständige Website für das Vereinsturnier **Waidcup**, mit
eigenem Prozess und eigener URL (liest dieselbe Datenbank read-only):

- **Standort & Infos** – Anreise, Karte, Turnier-Infos und Hinweise.
- **Turnierbaum** – die Tableaus mit Sieger-Hervorhebung.
- **Matches & Order of Play** – Tagesspielplan als Courts×Zeiten-Raster.
- **Live** – ein Live-Board der laufenden und nächsten Partien.
- **Webcam** & **Kiosk** – Kiosk-Ansicht für Grossbildschirme vor Ort, die
  vollständig mit der Fenstergrösse skaliert.
- **3D-Tour** – ein **begehbarer 3D-Rundgang** der Anlage (Three.js): frei
  bewegen, Live-Screens (Standort/Infos/Order of Play/Live) an den Wänden,
  Zählapparate an den Plätzen – und man kann sogar mit der Maus einen Tennisball
  werfen.

### Geteilte Bausteine (Packages)

Keine eigenständigen Apps, sondern die gemeinsame Grundlage aller drei Websites:

- **`@tcw/shared`** – isomorphe Typen, Konstanten, Übersetzungen und reine
  Domänenlogik (Sortierung, Namensabgleich).
- **`@tcw/core`** – Datenbank (SQLite), Konfiguration, die Integrationen zu
  SwissTennis/MyTennis/GotCourts sowie alle Backend-Dienste und Import-Jobs.
- **`@tcw/tournament-ui`** – geteilte React-Bausteine (Turnierbaum, Matchliste,
  Sprach-/Theme-Umschalter, i18n).

---

## Architektur

- **Backend:** Node.js + Fastify + better-sqlite3 (TypeScript). Getrennte
  Prozesse pro App zur strikten Sicherheitstrennung; jeder Server liefert seine
  API **und** das gebaute Frontend aus.
- **Frontend:** React 19 + Vite 6 + TypeScript, drei getrennte SPAs.
- **Datenbank:** eine gemeinsame SQLite-Datei (`ic_teams.sqlite`).
- **Monorepo:** npm-Workspaces mit den obigen `@tcw/*`-Paketen.

```
packages/shared        Typen, Konstanten, i18n, reine Domänenlogik
packages/core          DB, Konfiguration, SwissTennis-/MyTennis-/GotCourts-Integration, Dienste
packages/tournament-ui Geteilte React-Komponenten (Turnierbaum, Matchliste, …)
apps/public-server     Öffentliche API + Auslieferung des Vereins-Frontends (live 8092)
apps/admin-server      Interne Admin-API + Admin-Frontend + Hintergrund-Jobs (live 8093)
apps/waidcup-server    Waidcup-API + Auslieferung der Waidcup-Seite (Port 8096)
apps/web-public        React-SPA der öffentlichen Vereins-Seite (Dev-Port 5173)
apps/web-admin         React-SPA des Adminbereichs (Dev-Port 5174)
apps/waidcup-public    React-SPA der Waidcup-Seite inkl. 3D-Tour (Dev-Port 5176)
data/                  SQLite-Datenbank, Seeds, i18n-Ressourcen
scripts/               Migration, Importe, Backfills, 3D-Snapshot-Sync
docs/                  Status, Deployment und Design-/Implementierungsdokumente
```

---

## Installation & lokal starten

Voraussetzung: **Node.js 22+**.

```bash
npm install          # Abhängigkeiten installieren
npm run migrate      # Datenbank aus Bestand/Seeds aufbauen (idempotent, mit Backup)
```

Alle Apps zusammen im Entwicklungsmodus (Vereins-Seite + Admin + APIs):

```bash
npm run dev          # Public-API, Admin-API und beide Vite-Server gemeinsam
```

- Öffentliche Vereins-Seite: <http://localhost:5173>
- Adminbereich: <http://localhost:5174>

Die Waidcup-Seite separat starten (API + Frontend):

```bash
npm run seed:waidcup-test   # optional: Testdaten fürs Turnier anlegen
npm run dev:waidcup         # Waidcup-API + Vite-Server
```

- Waidcup-Seite: <http://localhost:5176>

Die Vite-Server leiten `/api`-Anfragen automatisch an die jeweilige Backend-API
weiter (8090 / 8091 / 8096).

### Nützliche Befehle

```bash
npm run typecheck    # TypeScript-Prüfung über alle Pakete
npm run lint         # ESLint (Flat Config, inkl. React-Hooks-Regeln)
npm run build        # Produktions-Build aller Frontends
npm run test         # Unit-Tests der Domänen-, Mapper- und Physik-Logik
npm run sync:tcw3d   # 3D-Rundgang-Snapshot aus dem separaten 3DTCW-Repo holen
```

Weitere Skripte: `refresh:tournaments` (Turniere von SwissTennis aktualisieren),
`backfill:player-matches`, `backfill:player-registry`, `import:agenda`.

### Konfiguration (Umgebungsvariablen)

| Variable | Default | Zweck |
| --- | --- | --- |
| `IC_DB_PATH` | `data/ic_teams.sqlite` | Pfad zur SQLite-Datenbank |
| `IC_PUBLIC_PORT` | `8090` | Port der öffentlichen Vereins-API (live auf **8092** gesetzt) |
| `IC_ADMIN_PORT` | `8091` | Port der Admin-API (live auf **8093** gesetzt) |
| `IC_WAIDCUP_PORT` | `8096` | Port der Waidcup-API |
| `IC_PUBLIC_HOST` | `0.0.0.0` | Bind-Adresse Public |
| `IC_ADMIN_HOST` | `127.0.0.1` | Bind-Adresse Admin (LAN-intern) |
| `IC_SWISSTENNIS_CACHE_TTL` | `7200` | Cache-Dauer für Turnier-Abrufe (Sek.) |
| `IC_RESULTS_CACHE_TTL` | `86400` | Cache-Dauer der IC-Ergebnisse (Sek.) |

> **Ports 8090/8091 nicht mit dem Livesystem verwechseln.** Das sind die Defaults im Code — und
> zugleich die Ports des noch laufenden **Altsystems**. Der Neubau läuft live auf **8092/8093**;
> die Start-Wrapper auf dem Server überschreiben `IC_PUBLIC_PORT` und `IC_ADMIN_PORT`
> entsprechend.

### Deployment & Status

- **Deployment** (drei Dienste auf einem Server): siehe
  [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **Ausbaustand / Phasen:** siehe [`docs/STATUS.md`](docs/STATUS.md).
