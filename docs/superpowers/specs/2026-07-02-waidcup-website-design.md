# Waidcup-Website — Design & Umsetzungs-Prompt

Status: **geplant, noch nicht umgesetzt.** Dieses Dokument ist der vollständige Umsetzungs-Prompt für eine spätere Session — kein Code wurde im Rahmen dieser Planung geschrieben.

> **Wichtige Klarstellung:** Dies ist **keine** neue Ansicht/kein neuer Tab innerhalb der bestehenden `apps/web-public`-Seite. Es entsteht eine **komplett separate, eigenständige Website** mit eigener URL/eigenem Port und eigenem Deployment (eigener Fastify-Prozess `waidcup-server` + eigenes Frontend `waidcup-public`, siehe „Architektur"). Die bestehende Seite (`apps/web-public` / `apps/public-server`) wird dabei **nicht verändert**, ausser den zwei explizit genannten Verschiebungen (CSS nach `packages/shared`, Turnierbaum-/Matchlisten-Komponenten nach `packages/tournament-ui` — jeweils mit angepasstem Importpfad, ohne Verhaltensänderung). Einzige Änderung an einem bestehenden *Prozess* ist das Job-Intervall in `apps/admin-server`.

## Ziel

Eine neue, eigenständige Website für den Waidcup (Swisstennis-Turnier-ID `158138`, bereits als Zeile in der `tournaments`-Tabelle vorhanden), optisch identisch zum Classic-Modus der bestehenden TCW-Spielbetrieb-Seite (`apps/web-public`). Sie zeigt:

1. Turnierbaum + Ergebnisse je Event/Bracket.
2. Eine filterbare Matchliste (Spielername, Bracket-Filter; kommende Matches oben mit Datum/Uhrzeit/Gegner inkl. Klassierung, gespielte darunter mit Ergebnis).
3. „Wer spielt gerade" — Live-Übersicht je Platz, aus derselben lokalen Datenbank, die der bestehende Turnier-Import ohnehin befüllt.
4. Einen Kiosk-Modus (eigene, chromelose URL) für einen Grossbildschirm am Turnier.

Aktueller Stand der Daten: Waidcup ist **noch nicht ausgelost** — `tournament_matches` hat 0 Zeilen für Waidcup (Stand dieser Planung). Die Seite muss damit sauber umgehen (leere Zustände) und funktioniert automatisch, sobald der bestehende Import-Job nach der Auslosung Daten liefert.

## Nicht-Ziele (bewusst ausgeschlossen)

- Keine Admin-/Bearbeitungsfunktion auf der neuen Seite (rein lesend).
- Kein neuer Swisstennis-Import-Mechanismus — die neue Seite liest ausschliesslich mit, was der bestehende `admin-server`-Job bereits in `tournament_matches`/`tournament_event_extras` schreibt.
- Kein Theme- oder Layout-Schalter auf der neuen Seite (fest im Classic/Club-Look, nur Sprachwahl bleibt).
- Kein Fake-Turnierbaum für Testdaten (nur die Live-Ansicht bekommt einen Testdaten-Pfad, siehe unten).

## Architektur

Zwei neue Apps im bestehenden Monorepo, nach dem Vorbild von `apps/public-server` + `apps/web-public`:

- **`apps/waidcup-server`** — neuer, schlanker Fastify-Server. Öffnet dieselbe `ic_teams.sqlite` **read-only** (wie `public-server` das heute tut, `openDatabase({ filePath, readonly: true })`). Liefert sowohl die API als auch das gebaute `waidcup-public`-Frontend aus (`fastifyStatic`, exakt wie `public-server` es für `web-public` macht). Ein Prozess, ein Port.
- **`apps/waidcup-public`** — neue Vite/React-19-SPA (gleicher Stack wie `web-public`), eigenes Hash-Routing, eigene kleine `navigation.ts`.

Kein neuer Admin-Prozess: Die Turnierdaten kommen weiterhin über den bestehenden `admin-server`-Job (`apps/admin-server/src/jobs.ts`, `tournamentService.refreshAllActive`).

### Geteilte Bausteine (gegen Design-/Logik-Drift)

- **CSS:** `apps/web-public/src/styles/app.css` wird nach `packages/shared/src/styles/app.css` verschoben und im `package.json` von `packages/shared` als zusätzlicher Export ergänzt (Muster existiert schon: `"./i18n/*": "./src/i18n/*"` → analog `"./styles/*": "./src/styles/*"`). Beide Apps importieren dieselbe Datei — `apps/web-public`'s Import-Pfad muss entsprechend angepasst werden (`@tcw/shared/styles/app.css` statt lokalem Pfad). Volles Stylesheet, keine Teilmenge — ungenutzte Klassen sind harmlos, eine Teilextraktion wäre fehleranfälliger.
- **Turnierbaum + Matchliste-Komponenten:** `TournamentBracket.tsx` und `MatchList.tsx` (aktuell `apps/web-public/src/features/tournaments/`) wandern in ein neues Paket `packages/tournament-ui` (React) und werden von **beiden** Apps importiert. Bestehender Aufrufer (`apps/web-public/src/features/tournaments/TournamentsView.tsx`) wird auf den neuen Importpfad umgestellt — reine Verschiebung, kein Verhaltensunterschied für die bestehende Seite.
  - `MatchList` bekommt einen neuen Prop `order: "playedFirst" | "upcomingFirst"` (Default `"playedFirst"` = heutiges Verhalten beibehalten; `TournamentsView.tsx` übergibt weiterhin nichts/Default). Die neue Waidcup-Matchliste übergibt `"upcomingFirst"`.
- **Types:** `TournamentBracket`, `TournamentBracketRound`, `TournamentBracketMatch`, `TournamentMatch`, `TournamentMatchStatus` (alle bereits in `packages/shared/src/types.ts`, ca. Zeilen 236–297) werden unverändert weiterverwendet — keine neuen Typen für Baum/Matchliste nötig.

## Backend: Datenmodell & neue Services

### „Wer spielt gerade" — Definition ohne künstliche Spieldauer

`tournament_matches` hat nur `scheduled_date`/`scheduled_time` (kein Ende), anders als die GotCourts-Reservationen bei der Plätze-Seite. Statt eine Spieldauer zu erfinden:

- **Läuft jetzt:** `status = "open"` UND `scheduled_date` = heute UND `scheduled_time` ≤ jetzt.
- **Als Nächstes:** `status = "open"` UND Termin in der Zukunft, sortiert nach Zeit (nächstes zuerst).

Selbstkorrigierend: Sobald ein Ergebnis erfasst wird, springt `status` auf `"played"` und das Match verschwindet automatisch aus „läuft jetzt" — kein Enddatum-Problem. Gruppierung nach `court`, analog zur bestehenden Zeitfenster-Logik in `packages/core/src/integrations/gotcourts/occupancy.ts::buildCourtBlocks` (gleiches Muster, andere Datenquelle).

### Neuer Service `packages/core/src/services/waidcup-service.ts`

Rein lesend, gefiltert auf eine konfigurierbare `tournamentId` (siehe Config unten):

```ts
export interface WaidcupLiveMatch {
  court: string;
  eventName: string;
  side1Names: string[];
  side2Names: string[];
  scheduledTime: string;
}
export interface WaidcupLiveResponse {
  now: WaidcupLiveMatch[];    // "läuft jetzt", nach Platz sortiert
  upcoming: WaidcupLiveMatch[]; // "als Nächstes", nach Zeit sortiert
}

export function getWaidcupLive(db: TcwDatabase, tournamentId: number): WaidcupLiveResponse
export function getWaidcupMatches(db: TcwDatabase, tournamentId: number): TournamentMatch[]
export function getWaidcupBrackets(db: TcwDatabase, tournamentId: number): TournamentEventView[] // liest bracket_json aus tournament_event_extras, wie getPublicTournaments() es heute schon tut
```

`getWaidcupMatches`/`getWaidcupBrackets` können weitgehend die bestehende Lese-Logik aus `packages/core/src/services/tournament-store.ts::getPublicTournaments()` wiederverwenden (dieselben SQL-Abfragen, nur gefiltert auf eine `tournamentId` statt auf alle aktiven Turniere) — kein neuer Parser, keine neue Bracket-Logik.

### Config: `WAIDCUP_TOURNAMENT_ID`

`packages/core/src/config.ts` (`loadConfig()`) bekommt ein neues Feld `waidcupTournamentId: number`, gelesen aus der Umgebungsvariable `WAIDCUP_TOURNAMENT_ID` (Default `158138`, die echte Waidcup-ID). Damit ist `waidcup-server` nie hart auf die ID verdrahtet — für Testdaten (siehe unten) einfach eine andere ID setzen.

### Job-Intervall

`apps/admin-server/src/jobs.ts`: `TOURNAMENT_JITTER_MS`-Task (aktuell `HOUR_MS`-Intervall, Zeile ~101) auf `30 * 60 * 1000` (30 Minuten) ändern. Bestehende `isQuietHour()`-Sperre (23–9 Uhr) bleibt unverändert. Das ist die einzige Änderung am bestehenden `admin-server`.

## Frontend

### Layout

Eigener Header/Tabbar/Footer im Classic-Look (importiert `@tcw/shared/styles/app.css`, `data-theme="club"` fest gesetzt, kein Theme-/Layout-Schalter-Element). Sprachwahl bleibt (eigene, schlanke `apps/waidcup-public/public/i18n/{de,en,fr}.json` — nicht die grossen bestehenden Dateien teilen, da die neue Seite nur wenige, neue Begriffe braucht).

### Seiten (3 Tabs + 1 chromelose Kiosk-Route)

1. **Turnierbaum** (`#brackets` o. ä.) — Event-/Kategorie-Auswahl (Herren/Damen, wie im bestehenden `TournamentPanel`-Muster), darunter `TournamentBracket` aus `packages/tournament-ui` für das gewählte Event. Leerer Zustand („Noch keine Auslosung") wenn `getWaidcupBrackets` nichts liefert.

2. **Matches** (`#matches`) — Freitext-Filter nach Spielername (beide Seiten, client-seitig über `side1Names`/`side2Names`, analog zur bestehenden `matchesPlayerSearch`-Logik in `TournamentsView.tsx`) + Bracket-Filter-Chips („Alle" + je Event). `MatchList` aus `packages/tournament-ui` mit `order="upcomingFirst"`. Kommende Matches zeigen Datum/Uhrzeit/Platz und beide Spielernamen inkl. Klassierung (steckt bereits im Namensstring, z. B. `"Rosin Stephan (R4)"` — keine separate Datenstruktur nötig). Gespielte darunter, neueste zuerst, mit Ergebnis.

3. **Live** (`#live`) — Ergebnis von `getWaidcupLive()`, gruppiert nach Platz. „Läuft jetzt"-Kacheln hervorgehoben, „Als Nächstes" darunter. Button/Link „Kiosk öffnen" → neuer Tab auf die Kiosk-Route. Leerer Zustand („Heute keine Partien terminiert") wenn `now` und `upcoming` beide leer sind.

4. **Kiosk-Route** (`#kiosk`, eigenständig, **kein** Header/Tabbar/Footer) — nur der Live-Block aus Punkt 3, aber grossformatig: eine Kachel pro Platz mit laufender Partie, grosse Schrift, Uhrzeit/Datum sichtbar. Pollt `getWaidcupLive()` client-seitig alle ~60 Sekunden neu (kein zusätzlicher Swisstennis-Call, liest nur die lokale API). Gedacht zum einmaligen Öffnen im Browser eines Venue-Bildschirms.

## Testdaten für „Wer spielt gerade"

Kein Testmodus-Code im Produktivpfad — stattdessen ein austauschbarer Config-Wert plus ein manuelles Seed-Skript:

- **Neues Skript** `scripts/seed-waidcup-test-data.ts` (läuft **nicht** automatisch mit `npm run migrate` mit; nur manuell per `npm run seed:waidcup-test` o. ä.). Es legt eine klar erkennbare Test-Turnier-Zeile in `tournaments` an (Name „Waidcup (Testdaten)", eigene, feste `swisstennis_tournament_id` ausserhalb des echten Wertebereichs, **`active = 0`**, damit sie vom echten Auslos-Import und vom generischen „Turniere"-Tab auf der Hauptseite unberührt bleibt) und füllt dazu passende `tournament_matches`-Zeilen:
  - ein paar **bereits gespielte** (Ergebnis gesetzt, `status="played"`, `scheduled_time` einige Zeit vor „jetzt"),
  - ein paar **laufende** (`status="open"`, `scheduled_time` kurz vor „jetzt"),
  - ein paar **kommende** (`status="open"`, `scheduled_time` in der Zukunft),
  - verteilt über mehrere Plätze (z. B. Platz 1–6) und mehrere Events, mit Spielernamen inkl. Klassierung im bestehenden Namensformat.
  - **Zeiten relativ zum Ausführungszeitpunkt** berechnet (nicht fest einprogrammiert) — das Skript ist beliebig oft neu ausführbar (löscht zuvor alle Zeilen der Test-Turnier-ID und legt sie frisch an) und liefert dann wieder plausible „gerade jetzt"-Daten.
- Für einen Testlauf: `WAIDCUP_TOURNAMENT_ID=<test-id>` setzen → die komplette Seite (Live, Matches, Kiosk) läuft unverändert gegen die Fake-Daten. Turnierbaum bleibt bei Testdaten leer (kein Fake-Bracket-JSON — zu fehleranfällig von Hand nachzubauen, war auch nicht Teil des Wunsches).

## Deployment

- Neuer Dienst `waidcup-server`, Vorschlag **Port 8096** (öffentlich, kein separater Admin-Port). Umgebungsvariablen analog zu `public-server`: `IC_DB_PATH`, `IC_WAIDCUP_PORT` (o. ä.), `WAIDCUP_TOURNAMENT_ID`.
- Neues `launchd`-Plist auf dem Server, analog zu `ch.tcw.ic-claude-public` (z. B. `ch.tcw.waidcup-public`).
- DB read-only geöffnet (WAL-Modus erlaubt bereits heute zwei parallele Leser + einen Schreiber; ein dritter Leser ist unproblematisch).

## Tests

- Unit-Test für `getWaidcupLive`/die Live-Aufteilungs-Logik (gleiche Machart wie der bestehende Test für `buildCourtBlocks` in `occupancy.test.ts`) — inkl. Fall „Ergebnis gerade erfasst → Match verschwindet aus live".
- Unit-Test für den neuen `order`-Prop von `MatchList` (beide Reihenfolgen, insbesondere: bestehendes Default-Verhalten bleibt für `apps/web-public` unverändert).
- Typecheck/Lint/Build für beide neuen Apps + die verschobenen Pakete.
- Manuelle Verifikation nach Umsetzung (Screenshots): Turnierbaum (leer + mit Testdaten falls ein echtes Draw-Beispiel verfügbar ist), Matches (Filter + beide Sortiergruppen), Live (leer + mit Seed-Testdaten), Kiosk (Vollbild, Testdaten, Autorefresh sichtbar).

## Offene Annahmen (Defaults, bei Bedarf in der Umsetzung anpassen)

- Port `8096` für `waidcup-server` ist ein Vorschlag, kein fixer Wert — beim Deployment auf freie Ports auf dem Server prüfen (belegt: 8090/8091 IC, 8092/8093 IC, 8095 cm-platz).
- „Als Nächstes" zeigt aktuell alle zukünftigen offenen Matches ohne Obergrenze — ggf. beim Bauen auf eine sinnvolle Anzahl/Zeitfenster begrenzen (z. B. nächste 2 Stunden oder nächste 10 Matches), falls die Liste bei vielen gleichzeitig laufenden Partien zu lang wird.
- Zielverzeichnis für die neue `tournament-ui`-Paket-Struktur (`packages/tournament-ui`) folgt der bestehenden Konvention von `packages/shared`/`packages/core` (eigenes `package.json`, `src/index.ts`-Export).

## Nächster Schritt

Dieses Dokument ist als vollständiger Umsetzungs-Prompt gedacht. In einer späteren Session: entweder direkt danach implementieren, oder zuerst mit der `writing-plans`-Skill einen granularen Schritt-für-Schritt-Plan daraus ableiten.
