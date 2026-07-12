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

1. **Umfang:** Alle `infos.*` + `location.*` Werte editierbar (feste Struktur, keine
   frei anlegbaren Blöcke).
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
- **Defaults bleiben in den i18n-JSONs**; DB-Override gewinnt, wenn vorhanden.
- **Manifest** der editierbaren Keys (in `@tcw/core` oder `@tcw/shared`): pro Key
  `type: "plain" | "rich"` und Gruppe (`infos` / `location`).
  - **plain:** Labels, Datumsangaben (`infos.dateDurationValue` …), Tableau-Größen,
    Preisgelder, Titel.
  - **rich:** Freitext-Blöcke — `infos.hint1/hint4/hint5/hint6`,
    `location.welcomeText/facilityText/transitText/parkingText`.
- Service (`@tcw/core`): `getWaidcupContent(db, lang) → { [key]: value }` (nur vorhandene
  Overrides), `setWaidcupContent(db, key, lang, value)` (sanitized rich-HTML vor dem
  Schreiben), plus `listEditableContent(db) → alle Keys × 4 Sprachen inkl. Defaults` für
  die Admin-UI.

### 2. Öffentliche Anzeige (Overrides einspielen)
- Neuer Endpoint `GET /api/waidcup/content?lang=xx` → Overrides für die Sprache.
- Waidcup-i18n-Laden **erweitern** (nur Waidcup, den geteilten `I18nProvider` nicht in
  seinem Default-Verhalten brechen): nach den statischen `/i18n/xx.json` zusätzlich die
  Overrides holen und **mergen** (Override gewinnt).
- **rich**-Keys in den Web-Views (`InfosView`, `LocationView`) über eine kleine
  `RichText`-Komponente als **sanitized HTML** rendern (`dangerouslySetInnerHTML` auf bereits
  server-seitig bereinigtem Wert). **plain**-Keys bleiben Text.
- **3D-Tour-Infos-Screen:** rich-Werte vor dem Canvas-Painten **Tags strippen → Text**
  (Canvas kann kein HTML). Der Screen-Treiber holt die Overrides mit.

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
- Felder gruppiert (Infos / Standort), je Feld 4 Sprach-Tabs (DE/EN/FR/IT).
- **rich**-Felder: WYSIWYG (Toolbar: fett/kursiv/Link/Aufzählung) → HTML.
  **plain**-Felder: normale ein-/mehrzeilige Eingaben.
- Button **„Übersetzen"** je Feld (und optional „alle fehlenden übersetzen"):
  `POST /api/admin/translate { text, targetLang, isHtml }` → Server → OpenAI (DE-Quelle,
  Ziel-Sprache, HTML-Tags erhalten) → füllt EN/FR/IT.
- **Speichern:** `PUT /api/admin/content` (pro Key/Sprache oder Batch). Server **sanitized**
  rich-HTML per Whitelist vor dem Schreiben.

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
- „Übersetzen" füllt EN/FR/IT plausibel aus dem DE-Text; HTML-Struktur bleibt erhalten.
- Ohne gültiges Cookie liefern `/api/admin/*`-Datenrouten 401.
- `/api/waidcup/content?lang=xx` liefert die Overrides; ohne Override greift der i18n-Default.

## Tests
- Content-Service: Merge/Override-Präzedenz, plain vs. rich.
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
