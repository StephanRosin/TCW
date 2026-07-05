# Design: „3D Tour"-Tab auf der Waidcup-Seite

Datum: 2026-07-05
Status: Freigegeben (User-Approval erhalten)
Betroffene Apps: `apps/waidcup-public` (Frontend), `apps/waidcup-server` (statisches Serving), sowie ein neues Sync-Script auf Repo-Ebene.
Externe App: `~/Dokumente/TCW3D/3DTCW` (separates Repo, Branch `claude/wonderful-hamilton-7mn4p7`).

## 1. Ziel

Auf der öffentlichen Waidcup-Seite kommt ein neuer Tab **„3D Tour"**, über den Besucher virtuell durch die Tennisanlage laufen können. Der Rundgang ist die bereits existierende, eigenständige 3D-App (Three.js). Zusätzlich sollen die **4 „Screens"** in der 3D-Welt mit Vereins-/Turnierinhalten bespielt werden.

Anforderungen (verbatim vom User):
- Neuer Tab „3D Tour", **nur Desktop** (auf Mobile ausgeblendet).
- Zuerst nur ein Button **„3D Tour starten"** — erst dann startet die 3D-App.
- Screen 1 → Standort-Daten (**ohne** Google-Maps-Einbettung, stattdessen die Adresse anzeigen).
- Screen 2 → Infos.
- Screen 3 → Order of Play.
- Screen 4 → Live (Kiosk-Modus, Light-Mode).

## 2. Faktenlage (aus Code-Exploration)

### 3D-App (`~/Dokumente/TCW3D/3DTCW`)
- Reine statische Dateien, **kein Build-Tool** (Vanilla-ES-Module + Importmap in `index.html`), Three.js r160 lokal gevendort unter `vendor/`.
- Entry: `index.html` → `js/main.js`. Assets (Texturen/Logos) ≈ 11 MB committet unter `assets/` (Audio ist git-ignored, App läuft ohne).
- **Asset-Pfade sind relativ zum Dokument** (`assets/textures/…`, kein Leading-Slash, keine `import.meta.url`-Auflösung). → Unter einem eigenen Basispfad (`/tcw3d/`) laufen sie unverändert, solange die Ordnerstruktur intakt bleibt.
- **Die 4 Screens** sind Three.js-`PlaneGeometry`-Meshes mit `MeshBasicMaterial`; Inhalt wird als **Textur** injiziert. Definiert in `js/screens.js` (`buildScreens`), Positionen `SCREEN_X = [-15, -19.5, -24, -28.5]`, Index 0 = Ost … 3 = West.
- **Injektions-API** (`js/main.js`): `window.__tcw.setScreen(i, source)` akzeptiert `THREE.Texture` | `HTMLVideoElement` (→ `VideoTexture`) | `HTMLCanvasElement` (→ `CanvasTexture`) | `HTMLImageElement` | `null` (dunkler Platzhalter). Bei animiertem Canvas muss `panel.material.map.needsUpdate = true` gesetzt (oder `setScreen` erneut aufgerufen) werden. Weitere Handles: `__tcw.screens`, `__tcw.teleport`, `__tcw.scene/camera/renderer/music`.
- **Kein** CSS3D-/iframe-als-Textur-Pfad, **kein** postMessage-Listener, **kein** URL-Param-Reader. Die App erwartet, die ganze Seite zu besitzen (Full-Window-Canvas, `window`-Resize-Listener, `document`-Pointer-Lock). → **iframe-Isolation** ist der saubere Einbettungsweg; same-origin kann der Host `iframe.contentWindow.__tcw.setScreen(...)` direkt aufrufen.

### Waidcup-Seite (`apps/waidcup-public`)
- React 19 + Vite 6, **Hash-Routing** (`useHashRoute`). Tab-Liste = Single Source of Truth in `src/app/navigation.ts` (`MAIN_VIEWS`, `NAV_ITEMS`). View-Switch in `src/App.tsx` (`ActiveView`-`switch`). Tabs gerendert in `src/components/SiteChrome.tsx` (`TabBar`, mappt `NAV_ITEMS`).
- Bestehende Views: Standort (`features/location/LocationView.tsx`), Infos (`features/infos/InfosView.tsx`, statisch), Order of Play (`features/orderofplay/OrderOfPlayView.tsx`, via `waidcupApi.orderOfPlay()`), Live (`features/live/LiveView.tsx`, via `waidcupApi.live()`), Kiosk (`features/kiosk/KioskView.tsx`, chrome-los, Hash `#kiosk`).
- **Kiosk hat bereits Light-/Dark-Mode** (`KioskMode`, Default **light**, `localStorage["waidcup-kiosk-mode"]`, CSS-Klasse `.kiosk--light` in `styles/waidcup.css:864-908`) — unabhängig vom 6-fach `data-theme`-System. Das ist die Referenz für Screen 4.
- **Adresse** existiert nicht als eigenständiger String — sie steckt nur in der Maps-Embed-URL (`LocationView.tsx:11`: „Waidbadstrasse 151, 8037 Zürich"). → Für Screen 1 als eigener i18n-/Konstanten-String zu führen.
- **Keine** Mobile-Erkennung im Code vorhanden (nur CSS-Media-Queries). → Muss neu geschaffen werden.
- Statische Assets: `apps/waidcup-public/public/` → von Vite nach `dist/` kopiert; `apps/waidcup-server` serviert `dist/` via `@fastify/static` unter `/` (`app.ts:88-90`), strikter 404-Handler für unbekannte Pfade (Hash-Routing, kein History-Fallback nötig).

## 3. Entwurfsentscheidungen (mit User bestätigt)

1. **Screen-Inhalt: Canvas gezeichnet.** Jeder Screen wird als eigenes, schlankes „Anzeigetafel"-Layout direkt auf ein `<canvas>` gemalt (Canvas-2D-API), keine Extra-Abhängigkeit, scharf und robust. Bewusst **nicht** 1:1 wie die Web-Tabs (kein html2canvas).
2. **Host treibt die Screens.** Die 3D-App bleibt datenagnostisch/wiederverwendbar; der Waidcup-Host holt Daten und ruft `setScreen`. Konsequenz: Screens sind nur befüllt, wenn der Rundgang **über die Waidcup-Seite** gestartet wird (standalone bleiben sie dunkel). **Kein Eingriff ins 3DTCW-Repo.**
3. **Vendoring: Snapshot + Sync-Script.** Dateien werden nach `apps/waidcup-public/public/tcw3d/` kopiert; `npm run sync:tcw3d` zieht Updates aus dem 3DTCW-Repo. Snapshot wird **committet** (~11 MB) für robusten Build/Deploy (Mac ist file-synced, kein Git).
4. **Auszuliefernder Stand:** Branch `claude/wonderful-hamilton-7mn4p7` (= origin/HEAD, enthält die Screen-API).
5. **Mobile-Grenze:** Tab ausgeblendet bei `max-width: 720px` (passt zum bestehenden Breakpoint; Rundgang braucht Maus + Pointer-Lock).

## 4. Architektur & Komponenten

Alle neuen Frontend-Dateien unter `apps/waidcup-public/src/features/tour/`:

- **`TourView.tsx`** — der Tab-Inhalt.
  - Zustand `started: boolean`. Vor Start: Titel + kurzer Teaser + Button **„3D Tour starten"**.
  - Nach Klick: rendert `<iframe src="/tcw3d/index.html" allow="pointer-lock; fullscreen" title="3D-Rundgang">` (Full-Size im Tab-Bereich).
  - Beim Verlassen des Tabs / Unmount wird der iframe entfernt (WebGL-Kontext + Pointer-Lock werden freigegeben). Erneuter Start lädt neu.
  - iframe-Ladefehler → dezenter Hinweistext.
- **`screenPainters.ts`** — reine Funktionen, je Screen eine: `paintLocation(ctx, data)`, `paintInfos(ctx, data)`, `paintOrderOfPlay(ctx, data)`, `paintLive(ctx, data)`. Zeichnen auf ein 1024×576-Canvas (16:9), „Anzeigetafel"-Stil. Keine Seiteneffekte außer aufs übergebene Canvas → unabhängig testbar. Gemeinsame Helfer (Titelzeile, Zeilen-Layout, Truncation, Fonts) in einem kleinen Modul (`paintHelpers.ts`).
- **`useScreenDriver.ts`** — Hook, der:
  1. auf `iframe.contentWindow.__tcw` wartet (Polling mit Timeout);
  2. Daten holt (`waidcupApi.orderOfPlay()`, `waidcupApi.live()`; Standort/Infos statisch/i18n);
  3. je Screen ein persistentes Canvas malt und `__tcw.setScreen(index, canvas)` aufruft;
  4. **Screen 3 (Order of Play)** und **Screen 4 (Live)** periodisch (~20 s) neu malt und `map.needsUpdate = true` setzt; **Screen 1/2** einmalig.
  - Fonts vor dem ersten Malen via `document.fonts.ready` abwarten (scharfe Schrift).
- **`useIsMobile.ts`** (bevorzugt in `packages/tournament-ui/src/`, sonst lokal) — `matchMedia("(max-width: 720px)")`-Hook mit Change-Listener. Erste Mobile-Erkennung im Projekt, wiederverwendbar.

### Screen-Zuordnung (setScreen-Index)

| Screen (User) | Index | Inhalt | Quelle | Refresh |
|---|---|---|---|---|
| 1 | 0 | Adresse „Waidbadstrasse 151, 8037 Zürich" + ÖV-/Parken-Text, **ohne Karte** | i18n/Konstante | einmalig |
| 2 | 1 | Infos (Daten, Tableaux, Preisgeld, Hinweise — kondensiert/legbar) | Infos-Texte/i18n | einmalig |
| 3 | 2 | Order of Play (heutige Matches als Tafel) | `waidcupApi.orderOfPlay()` | ~20 s |
| 4 | 3 | Live-Board im **Light-Mode** (Kiosk-Stil: heller Grund, dunkle Schrift) | `waidcupApi.live()` | ~20 s |

## 5. Integration in bestehende Dateien

- `src/app/navigation.ts`: `"tour"` in `MAIN_VIEWS` aufnehmen; `{ view: "tour", labelKey: "nav.tour" }` in `NAV_ITEMS` (Position am Ende oder nach „webcam" — final beim Umsetzen).
- `src/App.tsx`: `case "tour": return <TourView/>;` in `ActiveView`.
- `src/components/SiteChrome.tsx` (`TabBar`): beim Mappen von `NAV_ITEMS` per `useIsMobile()` den `"tour"`-Eintrag auf Mobile herausfiltern.
- i18n: `nav.tour` in `public/i18n/{de,en,fr,it}.json` ergänzen; ebenso etwaige neue Screen-Texte (Adresse/Standort-Label), soweit nicht als Konstante geführt.

## 6. 3D-App vendoren

- Neues Script `scripts/sync-tcw3d.ts` (npm-Script `sync:tcw3d`):
  - Quelle: `~/Dokumente/TCW3D/3DTCW` (fest, Branch `claude/wonderful-hamilton-7mn4p7`).
  - Ziel: `apps/waidcup-public/public/tcw3d/`.
  - Kopiert alles außer `.git/`, `serve.py`, `README.md`, evtl. `.gitignore` (nur Runtime-Dateien: `index.html`, `js/`, `vendor/`, `assets/`). Zielordner vorher leeren (idempotent).
  - Gibt eine kurze Zusammenfassung (Dateizahl, Gesamtgröße) aus.
- Vite kopiert `public/tcw3d/` → `dist/tcw3d/`; Fastify serviert es unter `/tcw3d/…`. Relative Asset-Pfade der App bleiben korrekt.
- Snapshot wird committet.

## 7. Fehlerbehandlung

- `__tcw` nicht innerhalb Timeout verfügbar → Rundgang läuft normal weiter, Screens bleiben im dunklen Platzhalter (kein Crash, kein Blockieren).
- API-Fehler (Order of Play / Live) → betroffener Screen zeigt einen dezenten Zustand („—" / „Keine Daten"), andere Screens unberührt.
- iframe-Ladefehler → Hinweistext im Tab, Start-Button erneut anbietbar.
- Tab-Wechsel / Sprachwechsel während laufendem Rundgang → Driver-Intervalle sauber aufräumen (Cleanup im `useEffect`).

## 8. Tests

- **`screenPainters` (Node `node:test`):** jede Paint-Funktion gegen ein Canvas-Stub/`node-canvas` — rendert ohne Wurf, ruft erwartete Zeichenbefehle (Titel, korrekte Zeilenanzahl, Truncation bei Überlänge). Deterministische Eingaben (feste Match-Listen).
- **`useScreenDriver`-Logik:** die reine Abbildung „Datentyp → Screen-Index" und die Refresh-Auswahl (welche Screens periodisch) als testbare Funktion herausgezogen und geprüft.
- **`useIsMobile`:** via `matchMedia`-Mock (Breakpoint-Wechsel → korrekter Boolean, Listener-Cleanup).
- Manuelle Verifikation: Tab erscheint nur > 720px; Start-Button lädt iframe; 4 Screens zeigen Adresse/Infos/OrderOfPlay/Live; Live/OrderOfPlay aktualisieren sich; Verlassen des Tabs gibt Pointer-Lock frei.

## 9. Bewusst ausgeschlossen (YAGNI)

- Kein postMessage-Bridge im 3DTCW-Repo (same-origin `__tcw`-Zugriff genügt).
- Keine html2canvas-Rasterung der echten React-Views.
- Kein Video-/Stream-Screen (Live = periodisch neu gemaltes Canvas).
- Keine Standalone-Befüllung der Screens außerhalb der Waidcup-Seite.
- Kein neues Backend/keine neuen API-Endpunkte (bestehende `waidcupApi` genügt).
