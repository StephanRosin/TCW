# TCW Spielbetrieb 2026 (Neubau)

Neubau der Interclub- und Turnier-Webseite des TC Waidberg. Ersetzt die
bestehende Python-/Vanilla-JS-Lösung ohne Funktionsverlust und integriert die
früher separate Waidcup-Turnierlogik nativ.

## Technologie

- **Backend:** Node.js + Fastify + better-sqlite3 (TypeScript), zwei Prozesse
  (Public + Admin) zur strikten Sicherheitstrennung.
- **Frontend:** React + Vite + TypeScript (getrennte Public- und Admin-App).
- **Datenbank:** SQLite (abwärtskompatibel zu `ic_teams.sqlite`).
- **Monorepo:** npm-Workspaces mit gemeinsamen Paketen `@tcw/shared`
  (isomorphe Typen/Konstanten/Domänenlogik) und `@tcw/core` (Backend-Dienste).

## Projektstruktur

```
packages/shared   Typen, Konstanten, reine Domänenfunktionen (Sortierung, i18n)
packages/core     DB, Konfiguration, Swisstennis-/MyTennis-Integration, Dienste
apps/public-server  Öffentliche API + Auslieferung des Public-Frontends (Port 8090)
apps/admin-server   Interne Admin-API + Admin-Frontend (Port 8091)
apps/web-public     React-SPA der öffentlichen Seite (Dev-Port 5173)
apps/web-admin      React-SPA des Adminbereichs (Dev-Port 5174)
data/               SQLite-Datenbank, Seeds, i18n-Ressourcen
scripts/            Migration, Importe
```

## Lokal starten

```bash
npm install          # Abhängigkeiten installieren
npm run migrate      # Datenbank aus Bestand/Seeds aufbauen (idempotent, mit Backup)
npm run dev          # Public-API, Admin-API und beide Vite-Server gemeinsam starten
```

Danach im Browser:

- Öffentliche Seite: <http://localhost:5173>
- Adminbereich: <http://localhost:5174>

Die Vite-Server leiten `/api`-Anfragen automatisch an die jeweilige Backend-API
weiter (8090 bzw. 8091).

## Nützliche Befehle

```bash
npm run typecheck    # TypeScript-Prüfung über alle Pakete
npm run build        # Produktions-Build beider Frontends
npm run test         # Unit-Tests der Domänenlogik (@tcw/core / @tcw/shared)
```

## Konfiguration (Umgebungsvariablen)

| Variable | Default | Zweck |
| --- | --- | --- |
| `IC_DB_PATH` | `data/ic_teams.sqlite` | Pfad zur SQLite-Datenbank |
| `IC_PUBLIC_PORT` | `8090` | Port der Public-API |
| `IC_ADMIN_PORT` | `8091` | Port der Admin-API |
| `IC_PUBLIC_HOST` | `0.0.0.0` | Bind-Adresse Public |
| `IC_ADMIN_HOST` | `127.0.0.1` | Bind-Adresse Admin (LAN-intern) |
| `IC_SWISSTENNIS_CACHE_TTL` | `7200` | Cache-Dauer externer Antworten (Sek.) |

## Ausbaustand

Siehe [`docs/STATUS.md`](docs/STATUS.md) für den Phasenfortschritt.
