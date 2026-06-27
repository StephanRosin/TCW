# Ausbaustand

Phasenweise Lieferung. Nach jeder Phase ist die App lokal lauffähig und testbar.

## Phase 1 – Fundament ✅

- npm-Monorepo (Workspaces) mit `@tcw/shared` und `@tcw/core`.
- Vollständiges SQLite-Schema (Teams, Spieler, Trainingsslots,
  Klassierungsänderungen, Spieltermine, Turniere nativ inkl. Events/Spieler/
  Matches, Import-Status, Swisstennis-Cache).
- Idempotentes Migrations-/Seed-Skript mit automatischem Backup:
  übernimmt Bestandsdaten oder seedet aus `teams_seed.json` /
  `training_slots.json`; bereinigt Spielernamen von Statuszusätzen.
- Beispiel-Spieltermine für lokale Tests geladen.
- Public- und Admin-Fastify-Server mit `/api/health` und Security-Headern.
- React/Vite-Schalen für Public und Admin, Dev-Proxy auf die APIs.

**Lokaler Test:** `npm install && npm run migrate && npm run dev` →
<http://localhost:5173> (Public), <http://localhost:5174> (Admin).

## Phase 2 – Public-Kern ✅

- Öffentliche API-Endpunkte: `/api/teams`, `/api/training-slots`,
  `/api/ranking-changes`, `/api/matches` (saubere DTOs, getestete Sortierung).
- React-Frontend mit tennisnahem Design (Sand/Clay/Court-Grün, Court-Linien-
  Motiv im Hero, Scoreboard-Tabellen), Hash-Routing, sticky Tab-Navigation.
- **Teams:** Damen/Herren-Umschalter, Teamkarten, Spieler nach Captain/
  Klassierung sortiert, klickbare MyTennis-Links, lokalisierte Teamnamen.
- **Trainingsplan:** Tageswahl, Platzraster 1–4 (18–22 Uhr), dynamische
  Teamnamen, mehrsprachige Legende.
- **Spieltermine:** Rundenfilter, Playoff-Badges, Waidberg-Hervorhebung,
  Importstand im Header, Swisstennis-Verlinkung.
- **Klassierungen:** Änderungen (Pfeile/Links/Datum) und Vergleich DE/US
  (LK ↔ Swiss Tennis ↔ NTRP) mit logischem Farbverlauf.
- **Mehrsprachigkeit DE/EN/FR** ohne Full Reload, Sprache im Local Storage,
  kontextuelle Übersetzung bekannter Begriffe (NLA/Damen/Aufstieg …).

Ergebnisse und Turniere zeigen aktuell einen Platzhalter (Phase 3/4).

## Phase 3 – Ergebnisse + Brackets ✅

- Serverseitige Swisstennis-Integration (EntryPage, TeamResults, EncountResults/
  TableauResults, DrawResults) mit gecachtem Client (TTL + Stale-Fallback) und
  zentraler Normalisierung in `@tcw/core`.
- API: `/api/ic/teams`, `/api/ic/team/:id`, `/api/ic/encount/:id`, `/api/ic/draw`.
- **Jahresauswahl** mit jahresspezifischen TeamIDs (EntryPage je Jahr).
- **Gruppenphase:** Resultate + Rangliste mit poolRank-Hybrid (Stats-Fallback),
  Waidberg-Hervorhebung.
- **Begegnungsdetail:** Einzel/Doppel mit Klassierungen (Doppel untereinander),
  Gewinner fett, Walkover „w.o.", „–" statt 0:0 bei offenen Matches.
- **Auf-/Abstiegs-Bracket** als visuelles Grid (border-bottom/right als Linien,
  „*" Heimteam, klickbare Score-Zellen); erscheint nur bei abgeschlossener
  Gruppenphase und korrekter Platzierung (3. Liga kein Aufstieg).
- **Detailjahr** kommt aus der Begegnung, nicht aus dem aktiven Ergebnis-Jahr.
- Klick auf ein Ergebnis in **Spieltermine** öffnet jetzt die App-eigene
  Detailansicht; der Swisstennis-Link liegt erst im Detail auf dem Score.

### Korrekturen aus Phase-2-Feedback
- Farbwelt auf **dezentes Clubblau** (Navy + Clay-Akzent) umgestellt.
- Teamkarten-Header: Teamziel/Trainingstag je eigene Zeile (gleiche Höhe).
- Lokale Datenbank aus dem **Livesystem** gezogen (read-only Snapshot):
  121 Spieler mit echten Klassierungen/MyTennis-IDs, 28 Klassierungsänderungen,
  62 Spieltermine. Re-Import via `npm run import:live`.

## Phase 4 – Turniere nativ + Polling ✅

Die früher externe Waidcup-Turnierlogik ist jetzt Kernmodul der App.

- Swisstennis-Turnier-Integration (TournamentDisplay, PublicDisplayEvent,
  DisplayDraw, DisplayPools) serverseitig, plus MyTennis-Linkauflösung.
- Importierte Daten werden je Turnier atomar in die DB ersetzt (Events,
  Anmeldungen, Matches); bei Fehlern bleiben alte Daten erhalten.
- API: `GET /api/tournaments` sowie Admin-Aktionen
  `POST /api/admin/tournaments/refresh`, `/api/admin/tournaments/:id/refresh`.
- **Frontend:** Turnierauswahl, Kategorien als Damen-/Herren-Zeile (DM in
  beiden) mit „Alle"-Filter und Spielersuche; je Status Anmeldungsliste
  (sortierbar) oder Matchliste (Tableau-Spalte, Datumssortierung, Gewinner
  fett, Doppel untereinander).
- **Jobs:** Hintergrund-Scheduler im Admin-Prozess – stündlicher ClubResult-
  Spieltermin-Import (ersetzt `import_clubresult.py`) und Turnier-Polling, je
  mit Jitter. Steuerbar über `IC_ENABLE_JOBS` / `IC_RESOLVE_PLAYER_URLS`.
- ClubResult-Importer mit Playoff-Erkennung (DrawResults) und atomarem,
  idempotentem Schreiben.

Verifiziert gegen Live-Swisstennis: Waidcup (Anmeldemodus, 93 Anmeldungen),
Clubmeisterschaft (Matchmodus, 129 Anmeldungen, 151 Round-robin-Matches),
ClubResult-Import (62 Spieltermine).

## Phase 5 – Admin-CRUD + MyTennis ✅

- Admin-API (Port 8091) mit CRUD für Teams, Spieler, Trainingsslots (Bulk-Grid),
  Klassierungsänderungen und Turniere; Validierung mit konkreten Fehlermeldungen
  (400) und Konfliktbehandlung (409).
- **MyTennis-Suche** mit robuster Namensnormalisierung (Akzente, Apostrophe,
  Bindestriche, zwei Vornamen) – verifiziert: Hubeková→Hubekova R1,
  O'Driscoll R7, Rosin R4. Auto-Suche bei neuem Spieler / Namensänderung
  (Klassierung + URL vorher leeren, dann übernehmen).
- **Klassierungsupdate** (URL-Match, nur echte Änderungen → `ranking_changes`)
  und **Spieltermin-Import** als Admin-Aktionen.
- **web-admin** React-UI (Port 5174) mit Tabs: Teams, Spieler, Trainingsraster
  (Wochengrid, ein Speichern-Button), Klassierungen, Turniere (CRUD + Refresh
  mit Status), Aktionen. IDs/created-Felder nicht editierbar; Löschen mit
  Bestätigung; sichere Ausgabe (kein untrusted innerHTML).

## Phase 6 – Deployment Server (parallel) ✅

- Beide Apps laufen auf dem Server **parallel** zum Altsystem unter eigenen
  Ports und eigener DB: Public `8092`, Admin `8093` (LaunchAgents
  `ch.tcw.ic-claude-public` / `ch.tcw.ic-claude-admin`).
- Nutzer-lokale Node-22-Runtime (`~/.local/node22`); `better-sqlite3` nativ für
  arm64 gebaut; beide Frontends auf dem Mac gebaut.
- Security verifiziert: `/` und Assets 200, DB/Quellcode/Logs/unbekannte Pfade
  liefern strikt **404** (SPA-Fallback entfernt, da Hash-Routing).
- Hintergrund-Jobs laufen (Turnier-Polling, Spieltermin-Import).
- Details und Betriebsbefehle: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md).

Offen für echten Produktivumstieg (separat): DB frisch ziehen, alte
LaunchAgents (8090/8091) deaktivieren, Admin-Zugang härten, DB-Backup-Job.
