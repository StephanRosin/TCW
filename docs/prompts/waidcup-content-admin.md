# Prompt: Waidcup Content-Admin (Infos + Standort editieren, per Klick übersetzen)

> **Status:** Noch nicht umgesetzt — später einsetzen. Die Design-Entscheidungen unten
> sind bereits mit dem Nutzer abgestimmt (Brainstorming erfolgt). Beim Aufgreifen:
> kurz das Design bestätigen → `superpowers:writing-plans` → `superpowers:subagent-driven-development`.
>
> **Secrets:** Diese Datei enthält bewusst **keine** Zugangsdaten. Admin-Passwort,
> Cookie-Secret und OpenAI-API-Key werden **out-of-band** übergeben und nur als
> **Server-Env-Variablen** gesetzt (nie ins Repo/Memory). Der früher im Chat geteilte
> OpenAI-Key ist als kompromittiert zu behandeln → **vor Nutzung rotieren**.

## Ziel

Eine **Admin-Oberfläche**, mit der sich alle **Infos-** und **Standort-Inhalte** der
Waidcup-Seite editieren lassen, inklusive **Klick-Übersetzung** (Deutsch → EN/FR/IT)
und **WYSIWYG-Editor** für die Freitext-Blöcke. Läuft im **selben Container** wie die
Waidcup-Seite (`waidcup-server`) unter **`/admin.html`**, ist **nicht** von der
öffentlichen Seite verlinkt und nur nach **Login** zugänglich.

## Kontext (Ausgangslage im Repo)

- Monorepo `~/Dokumente/IC_Webseite_Claude` (GitHub `StephanRosin/TCW`), npm-Workspaces,
  Fastify 5 + better-sqlite3 (tsx, kein Backend-Build), React 19 + Vite 6.
- **Waidcup-Seite:** Frontend `apps/waidcup-public`, Server `apps/waidcup-server`
  (Port 8096, öffentlich via Reverse-Proxy). `waidcup-server/src/app.ts` öffnet die DB
  aktuell **read-only**, liefert `apps/waidcup-public/dist` (fastifyStatic) + `/api/waidcup/*`,
  hat globales `@fastify/rate-limit`, Security-Header und `setNotFoundHandler` → 404.
- **Inhalte sind aktuell statisch** in den i18n-JSONs
  `apps/waidcup-public/public/i18n/{de,en,fr,it}.json` (Keys `infos.*`, `location.*`).
  Views: `apps/waidcup-public/src/features/infos/InfosView.tsx`,
  `.../features/location/LocationView.tsx`. Der **3D-Tour-Infos-Screen** wird aus denselben
  i18n-Keys gebaut (`apps/waidcup-public/src/features/tour/screenModel.ts`, `buildInfosModel`).
- Es gibt bereits eine generische **`settings`-Key/Value-Tabelle** + `settings-service`
  (`packages/core/src/services/settings-service.ts`) als Muster für Persistenz.
- i18n-Provider: `@tcw/tournament-ui` (`I18nProvider`, lädt `/i18n/{lang}.json`).

## Abgestimmte Entscheidungen

1. **Umfang:** Alle `infos.*` + `location.*` Inhalte editierbar (feste Struktur, keine
   frei anlegbaren Blöcke). Wichtig: nicht alles ist heute i18n-Text — es gibt auch
   **strukturierte, sprachneutrale** Werte, die editierbar sein müssen:
   - **Tableaux:** feste Kategorie-Zeilen (WS R1/R5, WS R5/R9, MS R1/R5, MS R5/R9, DM);
     pro Zeile die **Größe** wählbar (**8/16/32/64**). Zeilen werden NICHT hinzugefügt/
     entfernt. (Heute Zuordnung in `InfosView.tsx`-Array `TABLEAUX`; Größen-Labels in i18n.)
   - **Preisgelder:** die **CHF-Beträge** je Gruppe (Sieger/Finalist) editierbar. (Heute
     **hartkodiert** in `InfosView.tsx`, nicht i18n.)
   - **Links/URLs:** editierbar — Merkblatt-PDF (`infos.hintPdfUrl`), Parkkarte-Download
     (`location.parkingDownload`-Ziel), Google-Maps-Link.
   - Komfort: **„Auf Standard zurücksetzen" je Feld** und **Live-Vorschau** (siehe Editor-UI).
2. **Übersetzung:** **OpenAI** (`gpt-4o-mini`), Deutsch → EN/FR/IT, HTML-Tags erhalten.
   Key aus Env `OPENAI_API_KEY`.
3. **Editor:** **WYSIWYG → sanitized HTML** (TipTap o. Ä.) für die **rich**-Felder;
   normale Felder für **plain**-Werte.
4. **Login:** **Login-Formular + signiertes, httpOnly Session-Cookie**. Zugangsdaten aus
   Env `WAIDCUP_ADMIN_USER` / `WAIDCUP_ADMIN_PASSWORD`, Cookie-Signatur aus
   `WAIDCUP_ADMIN_SECRET`.

## Architektur

### 1. Content-Store (DB)
- Neue Tabelle `waidcup_content(key TEXT, lang TEXT, value TEXT, updated_at TEXT,
  PRIMARY KEY(key, lang))` (Migration in `packages/core/src/db/schema.ts`).
- **Defaults bleiben in den i18n-JSONs bzw. im Code** (Tableaux/Preise/URLs, siehe unten);
  DB-Override gewinnt, wenn vorhanden. „Auf Standard zurücksetzen" = DB-Override löschen.
- Zwei Arten von Inhalt, unterschieden über ein **Manifest** (in `@tcw/core` oder
  `@tcw/shared`), je Key `type`, `group` (`infos`/`location`) und `perLang`:
  - **Pro Sprache (`perLang: true`)** — je Sprache ein eigener Wert:
    - `text-plain`: Labels, Titel, Datumsangaben (`infos.dateDurationValue` …).
    - `text-rich`: Freitext-Blöcke (WYSIWYG) — `infos.hint1/hint4/hint5/hint6`,
      `location.welcomeText/facilityText/transitText/parkingText`.
  - **Sprachneutral (`perLang: false`)** — ein Wert für alle Sprachen, unter dem
    Sentinel-`lang = "*"` gespeichert:
    - `enum` (Tableau-Größe je Kategorie, erlaubt 8/16/32/64): Keys z. B.
      `infos.tableau.ws_r1r5`, `…ws_r5r9`, `…ms_r1r5`, `…ms_r5r9`, `…dm`. Das angezeigte
      Label („8er Tableau"/„Draw of 8") wird pro Sprache aus der Zahl + i18n-Suffix
      **gerendert** (nicht gespeichert).
    - `number` (CHF-Beträge): z. B. `infos.prize.g1.winner`, `…g1.finalist`,
      `…g2.winner`, `…g2.finalist`.
    - `url` (Links): `infos.hintPdfUrl`, `location.parkingUrl`, `location.mapsUrl`.
- Service (`@tcw/core`):
  - `getWaidcupContent(db, lang) → { [key]: value }` — perLang-Overrides der Sprache **plus**
    alle sprachneutralen Overrides (`lang="*"`).
  - `setWaidcupContent(db, key, lang, value)` — validiert gegen das Manifest (Typ/enum-Werte/
    URL-Schema), sanitized `text-rich` vor dem Schreiben; `perLang:false` immer mit `lang="*"`.
  - `resetWaidcupContent(db, key, lang)` — löscht den Override (Default greift wieder).
  - `listEditableContent(db) → alle Keys inkl. Typ, Gruppe, aktuellem Wert (bzw. Default)
    je Sprache` für die Admin-UI.

### 2. Öffentliche Anzeige (Overrides einspielen)
- Neuer Endpoint `GET /api/waidcup/content?lang=xx` → Overrides für die Sprache.
- Waidcup-i18n-Laden **erweitern** (nur Waidcup, den geteilten `I18nProvider` nicht in
  seinem Default-Verhalten brechen): nach den statischen `/i18n/xx.json` zusätzlich die
  Overrides holen und **mergen** (Override gewinnt).
- **rich**-Keys in den Web-Views (`InfosView`, `LocationView`) über eine kleine
  `RichText`-Komponente als **sanitized HTML** rendern (`dangerouslySetInnerHTML` auf bereits
  server-seitig bereinigtem Wert). **plain**-Keys bleiben Text.
- **Strukturelle Umstellung (wichtig):** `InfosView.tsx` muss die heute im Code stehenden
  Werte aus dem Content beziehen statt hartkodiert:
  - **Tableaux:** feste Kategorie-Zeilen bleiben im Code, aber die **Größe je Zeile** kommt
    aus dem Content (`infos.tableau.<kat>` → Zahl); das Label wird per Sprache aus der Zahl +
    i18n-Suffix gerendert (z. B. Zahl 8 → `t("infos.tableauSuffix")` → „8er Tableau").
  - **Preisgelder:** die CHF-Beträge aus dem Content (`infos.prize.*`) statt der hartkodierten
    `CHF 500`-Literale.
  - **URLs:** `hintPdfUrl`/`parkingUrl`/`mapsUrl` aus dem Content.
- **3D-Tour-Infos-Screen:** rich-Werte vor dem Canvas-Painten **Tags strippen → Text**
  (Canvas kann kein HTML); Tableau-Zeilen ebenfalls aus den Content-Zahlen bauen. Der
  Screen-Treiber holt die Overrides mit.

### 3. Admin unter `/admin.html` (gleicher Container)
- **Zweiter Vite-Entry** in `apps/waidcup-public` (Multi-Page): `admin.html` + `admin.tsx`,
  wird mitgebaut und von `waidcup-server` (fastifyStatic aus `dist`) mit ausgeliefert.
  **Nicht** in der öffentlichen Navigation verlinken.
- `waidcup-server`: zusätzlich **schreibbare** DB-Verbindung nur für Admin-Writes öffnen
  (Public-API bleibt read-only). `@fastify/cookie` registrieren. Admin-Routen **vor** dem
  `setNotFoundHandler` registrieren.
- **Auth-Flow:**
  - `POST /api/admin/login` prüft User/Passwort (Env, konstant-Zeit-Vergleich), setzt
    signiertes httpOnly-Cookie (`secure` hinter HTTPS-Proxy, `sameSite=lax`).
  - `POST /api/admin/logout` löscht das Cookie.
  - preHandler schützt `GET/PUT /api/admin/content` und `POST /api/admin/translate`
    (401 ohne gültiges Cookie). Login + Translate zusätzlich rate-limiten.
  - `/admin.html` selbst darf öffentlich erreichbar sein (nur Login-Shell); die **Daten**
    sind geschützt.

### 4. Editor-UI (`admin.tsx`)
- Felder gruppiert (Infos / Standort). **Editor je Feldtyp** (aus dem Manifest):
  - `text-rich`: WYSIWYG (Toolbar fett/kursiv/Link/Aufzählung) → HTML, mit 4 Sprach-Tabs.
  - `text-plain`: ein-/mehrzeilige Eingabe, 4 Sprach-Tabs.
  - `enum` (Tableau-Größe): Dropdown 8/16/32/64 — **sprachneutral** (kein Sprach-Tab).
  - `number` (CHF): Zahlenfeld — sprachneutral.
  - `url`: URL-Feld (Validierung http/https/mailto) — sprachneutral.
- **„Übersetzen"** nur bei Textfeldern (`text-plain`/`text-rich`), je Feld und „alle
  fehlenden übersetzen": `POST /api/admin/translate { text, targetLang, isHtml }` → Server →
  OpenAI (DE-Quelle → Ziel; HTML-Tags erhalten) → füllt EN/FR/IT. Numbers/enum/url werden
  nicht übersetzt.
- **„Auf Standard zurücksetzen"** je Feld → `resetWaidcupContent` (löscht Override, Default greift).
- **Live-Vorschau:** je Feld (v. a. `text-rich`) eine Vorschau, wie der Inhalt öffentlich
  gerendert würde (dieselbe `RichText`-/Label-Logik wie Public); optional eine Gesamt-Vorschau
  der Infos-/Standort-Seite.
- **Speichern:** `PUT /api/admin/content` (pro Key/Sprache oder Batch). Server **validiert**
  gegen das Manifest und **sanitized** `text-rich` per Whitelist vor dem Schreiben.

### 5. Übersetzungs-Endpoint
- `POST /api/admin/translate` → Server ruft OpenAI (`OPENAI_API_KEY` aus Env; simpler
  `fetch` auf die Chat-Completions-API genügt, kein SDK zwingend). Prompt: „Übersetze den
  folgenden Text von Deutsch nach {Ziel}. Bei HTML: Tags/Attribute unverändert lassen, nur
  Textknoten übersetzen. Keine Erklärungen." Fehler/Timeout sauber als 502 zurückgeben.

## Neue Abhängigkeiten
`@fastify/cookie`, `sanitize-html` (server-seitige Whitelist), ein WYSIWYG (z. B. TipTap /
`@tiptap/react` + StarterKit). OpenAI-Aufruf via `fetch` (kein SDK nötig).

## Sicherheit (verbindlich)
- **Keine Secrets im Repo/Memory.** `OPENAI_API_KEY`, `WAIDCUP_ADMIN_USER`,
  `WAIDCUP_ADMIN_PASSWORD`, `WAIDCUP_ADMIN_SECRET` nur als Server-Env (auf dem Server-Host,
  z. B. via `bin/run-waidcup.sh` / LaunchAgent-Env, gitignored).
- **OpenAI-Key rotieren** (der geteilte Key war im Chat sichtbar).
- rich-HTML **server-seitig sanitizen** (Whitelist z. B. `b i u strong em a[href] ul ol li p br`;
  Links auf `http/https/mailto` beschränken, `rel="noopener nofollow"`, kein `javascript:`).
- Cookie httpOnly + signiert + `secure` (hinter dem HTTPS-Reverse-Proxy). Login-Vergleich
  konstant-Zeit. Login/Translate rate-limited.
- Admin nicht verlinkt; unbekannte Pfade weiterhin strikt 404.

## Akzeptanzkriterien
- Aufruf `/admin.html` ohne Login zeigt Login-Formular; falsche Daten → Fehler, keine
  Session. Nach Login: Editor sichtbar.
- Editieren eines Infos- und eines Standort-Werts (plain + rich), Speichern → öffentliche
  Waidcup-Seite (Web + 3D-Tour-Screen) zeigt die Änderung nach Reload; rich als
  formatierter, **sanitized** Text (eingeschleustes `<script>` wird entfernt).
- **Tableau-Größe** einer Kategorie (z. B. MS R1/R5) im Admin ändern → Infos-Seite und
  3D-Tour-Screen zeigen die neue Größe (Label pro Sprache korrekt gerendert).
- **Preisgeld** (CHF-Betrag) und eine **URL** (z. B. Merkblatt-PDF) ändern → öffentliche
  Seite übernimmt es.
- **„Auf Standard zurücksetzen"** eines Felds → öffentlicher Wert entspricht wieder dem
  eingebauten Default (Override in DB entfernt).
- **Live-Vorschau** zeigt für ein `text-rich`-Feld dieselbe Darstellung wie die Public-Seite.
- „Übersetzen" füllt EN/FR/IT plausibel aus dem DE-Text; HTML-Struktur bleibt erhalten.
  Numbers/enum/url werden nicht übersetzt.
- Ohne gültiges Cookie liefern `/api/admin/*`-Datenrouten 401.
- `/api/waidcup/content?lang=xx` liefert die per-Sprache- **und** sprachneutralen Overrides;
  ohne Override greift der Default (i18n bzw. Code).

## Tests
- Content-Service: Merge/Override-Präzedenz; per-Sprache vs. sprachneutral (`lang="*"`);
  `reset` entfernt Override → Default greift.
- Manifest-Validierung: `enum` nur 8/16/32/64, `url` nur erlaubte Schemata, `number` numerisch;
  ungültige Werte → 400.
- Sanitizer: entfernt `<script>`/Event-Handler/`javascript:`, behält Whitelist.
- Auth: Login OK/Fehlschlag, geschützte Route ohne Cookie → 401.
- Translate: **gemockter** OpenAI-Aufruf (keine echten API-Calls im Test), HTML-Erhalt.
- Manuell/E2E im Rundgang: Login → Edit → Übersetzen → Speichern → Public spiegelt.

## Phasierung (optional)
1. Content-Store (DB + Manifest + Service) und öffentliche Anzeige (Endpoint + i18n-Merge +
   RichText/Tag-Strip).
2. Admin-Shell: `/admin.html`-Entry + Login/Cookie + geschützte `content`-Routen + Editor
   (plain + WYSIWYG) + Speichern.
3. Klick-Übersetzung (OpenAI-Endpoint + UI-Buttons).

## Deployment-Notiz
Wie üblich (siehe `docs/DEPLOYMENT.md`): geänderte Quelldateien auf den Server, `waidcup-public`
neu bauen, `waidcup-server`-Dienst neu starten. **Zusätzlich** die neuen Env-Variablen im
Start-Wrapper/LaunchAgent hinterlegen (Secrets, gitignored). Neue DB-Tabelle via Migration.
