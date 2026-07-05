# 3D-Tour-Tab (Waidcup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neuer Desktop-only Tab „3D Tour" auf der Waidcup-Seite bettet die bestehende 3D-Rundgang-App per iframe ein (Start-Button first) und bespielt deren 4 In-World-Screens host-getrieben mit Canvas-gemalten Tafeln (Standort / Infos / Order of Play / Live-Kiosk-Light).

**Architecture:** Die 3D-App (`~/Dokumente/TCW3D/3DTCW`, statische Dateien, exponiert `window.__tcw.setScreen(i, canvas)`) wird als Snapshot nach `apps/waidcup-public/public/tcw3d/` gevendort und unter `/tcw3d/index.html` serviert. Ein neues `TourView` rendert nach Klick auf „3D Tour starten" einen `<iframe>`; ein `useScreenDriver`-Hook wartet auf `iframe.contentWindow.__tcw`, holt Daten über die bestehende `waidcupApi`, malt pro Screen ein 1024×576-Canvas (reine Model-Builder + generischer Painter) und ruft `setScreen`. Order-of-Play und Live werden ~20 s periodisch neu gemalt.

**Tech Stack:** React 19 + Vite 6 (`apps/waidcup-public`), TypeScript, Canvas-2D-API, Three.js-App (fremd, unverändert), Node built-in test runner (`node --import tsx --test`).

## Global Constraints

- Clean Code nach `~/AGENTS.md` (kleine, fokussierte Dateien; sprechende Namen; deutsche Kommentare im Stil des bestehenden Codes; DRY/YAGNI).
- **Keine** Änderung am 3DTCW-Repo — nur same-origin-Zugriff auf das bestehende `window.__tcw`.
- **Keine** neuen Backend-Endpunkte — nur die bestehende `waidcupApi` (`live()`, `orderOfPlay()`).
- Frontend-Tests laufen mit `node --import tsx --test "src/**/*.test.ts"` (Muster wie `@tcw/core`). Nur **reine** Logik (Model-Builder, Mapping, Nav-Filter) wird unit-getestet; Canvas-Zeichnen und DOM-Hooks werden manuell verifiziert.
- Canvas-Auflösung fix **1024×576** (16:9), passend zu den 16:9-Screens der 3D-App.
- Auszuliefernder 3D-App-Stand: Branch `claude/wonderful-hamilton-7mn4p7`.
- Mobile-Grenze: Tab ausgeblendet bei `max-width: 720px`.
- Screen-Index-Zuordnung: `location`→0, `infos`→1, `orderofplay`→2, `live`→3 (Index 0 = Ost-Screen der 3D-App).
- TDD: erst der fehlschlagende Test, dann Minimal-Implementierung. Häufige Commits (ein Commit pro Task).

## File Structure

Neue Dateien (alle unter `apps/waidcup-public/` sofern nicht anders angegeben):
- `scripts/sync-tcw3d.ts` (Repo-Root) — kopiert die 3D-App nach `public/tcw3d/`.
- `apps/waidcup-public/public/tcw3d/**` — gevendorter Snapshot (committet).
- `src/features/tour/screenModel.ts` — Typen + reine Model-Builder (`buildLocationModel`, `buildInfosModel`, `buildOrderOfPlayModel`, `buildLiveModel`).
- `src/features/tour/screenModel.test.ts` — Tests der Builder.
- `src/features/tour/screenPainter.ts` — generischer Canvas-Painter (`paintScreen`).
- `src/features/tour/screenDriver.ts` — `SCREEN_INDEX`-Mapping + `useScreenDriver`-Hook.
- `src/features/tour/screenDriver.test.ts` — Test des Mappings.
- `src/features/tour/TourView.tsx` — der Tab (Start-Button + iframe).
- `src/features/tour/address.ts` — Adress-Konstante (Screen 1).
- `src/hooks/useIsMobile.ts` — `matchMedia`-Hook.
- `src/app/navFilter.ts` — reine `filterNavForViewport`-Funktion.
- `src/app/navFilter.test.ts` — Test.

Geänderte Dateien:
- `apps/waidcup-public/package.json` — `test`-Script.
- `package.json` (Root) — `sync:tcw3d`-Script; `test` um waidcup-public erweitern.
- `src/app/navigation.ts` — `"tour"` in `MAIN_VIEWS` + `NAV_ITEMS`.
- `src/App.tsx` — `case "tour"`.
- `src/components/SiteChrome.tsx` — Nav per Mobile filtern.
- `public/i18n/{de,en,fr,it}.json` — neue Keys.

---

## Task 1: 3D-App vendoren (Sync-Script + Snapshot)

**Files:**
- Create: `scripts/sync-tcw3d.ts`
- Modify: `package.json` (Root, `scripts`)
- Create (generiert): `apps/waidcup-public/public/tcw3d/**`

**Interfaces:**
- Produces: statischer Snapshot unter `apps/waidcup-public/public/tcw3d/index.html` (+ `js/`, `vendor/`, `assets/`), erreichbar zur Laufzeit unter `/tcw3d/index.html`.

- [ ] **Step 1: Sync-Script schreiben**

Create `scripts/sync-tcw3d.ts`:

```ts
/**
 * Kopiert die eigenständige 3D-Rundgang-App (separates Repo) als Snapshot in
 * die statischen Assets der Waidcup-Seite, damit sie unter /tcw3d/ ausgeliefert
 * wird. Idempotent: Zielordner wird vorher geleert. Nur Laufzeit-Dateien –
 * .git, README, Dev-Server und .gitignore bleiben draussen.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const SRC = process.env.TCW3D_SRC ?? join(homedir(), "Dokumente/TCW3D/3DTCW");
const DEST = resolve(process.cwd(), "apps/waidcup-public/public/tcw3d");
const SKIP = new Set([".git", "README.md", "serve.py", ".gitignore"]);

function directorySizeMb(dir: string): number {
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    bytes += entry.isDirectory() ? directorySizeMb(full) * 1024 * 1024 : statSync(full).size;
  }
  return bytes / 1024 / 1024;
}

if (!existsSync(join(SRC, "index.html"))) {
  throw new Error(`3D-App nicht gefunden unter ${SRC} (index.html fehlt). TCW3D_SRC setzen?`);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

let count = 0;
for (const entry of readdirSync(SRC, { withFileTypes: true })) {
  if (SKIP.has(entry.name)) continue;
  cpSync(join(SRC, entry.name), join(DEST, entry.name), { recursive: true });
  count += 1;
}

console.log(`3D-App synchronisiert: ${count} Einträge, ~${directorySizeMb(DEST).toFixed(1)} MB → ${DEST}`);
```

- [ ] **Step 2: npm-Script ergänzen**

In `package.json` (Root) unter `"scripts"` nach `"migrate:drop-redundant"` einfügen:

```json
    "sync:tcw3d": "tsx scripts/sync-tcw3d.ts",
```

- [ ] **Step 3: Script ausführen**

Run: `npm run sync:tcw3d`
Expected: Ausgabe `3D-App synchronisiert: N Einträge, ~11.x MB → …/public/tcw3d`

- [ ] **Step 4: Snapshot verifizieren**

Run: `test -f apps/waidcup-public/public/tcw3d/index.html && test -f apps/waidcup-public/public/tcw3d/js/main.js && test -d apps/waidcup-public/public/tcw3d/assets && echo OK`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-tcw3d.ts package.json apps/waidcup-public/public/tcw3d
git commit -m "feat(waidcup): 3D-App als Snapshot vendoren + sync:tcw3d-Script"
```

---

## Task 2: Test-Harness + Screen-Model-Builder (reine Logik, TDD)

**Files:**
- Modify: `apps/waidcup-public/package.json` (`scripts.test`)
- Modify: `package.json` (Root, `scripts.test`)
- Create: `apps/waidcup-public/src/features/tour/address.ts`
- Create: `apps/waidcup-public/src/features/tour/screenModel.ts`
- Test: `apps/waidcup-public/src/features/tour/screenModel.test.ts`

**Interfaces:**
- Consumes: `WaidcupLiveMatch`, `WaidcupLiveResponse` aus `@tcw/shared`; eine Übersetzungsfunktion `type Translate = (key: string) => string`.
- Produces:
  - `interface TextLine { text: string; emphasis?: boolean }`
  - `interface TableColumn { header: string; x: number }`
  - `interface ScreenModel { title: string; theme: "dark" | "light"; layout: "text" | "table"; textLines?: TextLine[]; columns?: TableColumn[]; rows?: string[][]; note?: string }`
  - `const BOARD_COLUMNS: TableColumn[]` (Platz/Zeit/Match/Kategorie)
  - `const MAX_TABLE_ROWS = 9`
  - `buildLocationModel(t: Translate): ScreenModel`
  - `buildInfosModel(t: Translate): ScreenModel`
  - `buildOrderOfPlayModel(matches: WaidcupLiveMatch[], t: Translate): ScreenModel`
  - `buildLiveModel(live: WaidcupLiveResponse, t: Translate): ScreenModel`

- [ ] **Step 1: Test-Script in waidcup-public ergänzen**

In `apps/waidcup-public/package.json` unter `"scripts"` ergänzen (nach `"preview"`):

```json
    "test": "node --import tsx --test \"src/**/*.test.ts\""
```

- [ ] **Step 2: Root-Test um waidcup-public erweitern**

In `package.json` (Root) das `"test"`-Script ändern zu:

```json
    "test": "npm -w @tcw/shared run test && npm -w @tcw/core run test && npm -w @tcw/tournament-ui run test && npm -w @tcw/waidcup-public run test",
```

- [ ] **Step 3: Adress-Konstante anlegen**

Create `apps/waidcup-public/src/features/tour/address.ts`:

```ts
/** Anschrift des TCW für den Standort-Screen (statt Google-Maps-Einbettung). */
export const WAIDCUP_ADDRESS_LINES = ["Tennisclub Waidberg", "Waidbadstrasse 151", "8037 Zürich"] as const;
```

- [ ] **Step 4: Failing test schreiben**

Create `apps/waidcup-public/src/features/tour/screenModel.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
  MAX_TABLE_ROWS,
} from "./screenModel.js";

// Übersetzungs-Stub: gibt den Key zurück, damit Tests keys statt Texte prüfen.
const t = (key: string): string => key;

function match(court: string, time: string, s1: string[], s2: string[], date = "2026-07-18"): WaidcupLiveMatch {
  return { court, eventName: "Herren R1/R5", side1Names: s1, side2Names: s2, scheduledDate: date, scheduledTime: time };
}

test("buildLocationModel: Text-Layout mit Adresszeilen und ÖV/Parken", () => {
  const model = buildLocationModel(t);
  assert.equal(model.layout, "text");
  assert.equal(model.theme, "dark");
  const texts = model.textLines!.map((l) => l.text);
  assert.ok(texts.includes("Waidbadstrasse 151"), "Adresse enthalten");
  assert.ok(texts.some((x) => x === "location.transitText"), "ÖV-Text enthalten");
});

test("buildOrderOfPlayModel: Tabelle, eine Zeile pro Match, Match-Zelle 'a/b vs c/d'", () => {
  const model = buildOrderOfPlayModel([match("1", "09:00", ["Ann A"], ["Bea B"])], t);
  assert.equal(model.layout, "table");
  assert.equal(model.rows!.length, 1);
  assert.deepEqual(model.rows![0], ["1", "09:00", "Ann A vs Bea B", "Herren R1/R5"]);
});

test("buildOrderOfPlayModel: leer -> Hinweiszeile als Note, keine Rows", () => {
  const model = buildOrderOfPlayModel([], t);
  assert.equal(model.rows!.length, 0);
  assert.equal(model.note, "orderOfPlay.empty");
});

test("buildOrderOfPlayModel: über MAX_TABLE_ROWS gekürzt, Note zeigt Rest", () => {
  const many = Array.from({ length: MAX_TABLE_ROWS + 3 }, (_, i) => match(String(i), "10:00", ["X"], ["Y"]));
  const model = buildOrderOfPlayModel(many, t);
  assert.equal(model.rows!.length, MAX_TABLE_ROWS);
  assert.equal(model.note, "+3");
});

test("buildLiveModel: Light-Theme, 'now' zuerst, dann 'upcoming'", () => {
  const live: WaidcupLiveResponse = {
    now: [match("2", "11:00", ["Now1"], ["Now2"])],
    upcoming: [match("3", "12:00", ["Up1"], ["Up2"])],
  };
  const model = buildLiveModel(live, t);
  assert.equal(model.theme, "light");
  assert.equal(model.layout, "table");
  assert.equal(model.rows![0]![2], "Now1 vs Now2");
  assert.equal(model.rows![1]![2], "Up1 vs Up2");
});

test("buildInfosModel: Text-Layout mit Turnierdauer", () => {
  const model = buildInfosModel(t);
  assert.equal(model.layout, "text");
  assert.ok(model.textLines!.some((l) => l.text === "infos.dateDurationValue"));
});
```

- [ ] **Step 5: Test ausführen (muss fehlschlagen)**

Run: `npm -w @tcw/waidcup-public run test`
Expected: FAIL („Cannot find module './screenModel.js'")

- [ ] **Step 6: Model-Builder implementieren**

Create `apps/waidcup-public/src/features/tour/screenModel.ts`:

```ts
/**
 * Reine Model-Builder für die vier In-World-Screens der 3D-Tour. Sie liefern
 * ein layout-neutrales ScreenModel (Text- oder Tabellen-Tafel), das der
 * Canvas-Painter zeichnet. Keine DOM-/Canvas-Abhängigkeit -> unit-testbar.
 */
import type { WaidcupLiveMatch, WaidcupLiveResponse } from "@tcw/shared";
import { WAIDCUP_ADDRESS_LINES } from "./address.js";

type Translate = (key: string) => string;

export interface TextLine {
  text: string;
  emphasis?: boolean;
}

export interface TableColumn {
  header: string;
  x: number;
}

export interface ScreenModel {
  title: string;
  theme: "dark" | "light";
  layout: "text" | "table";
  textLines?: TextLine[];
  columns?: TableColumn[];
  rows?: string[][];
  note?: string;
}

/** Spalten der Match-Tafeln (x in Canvas-Pixeln bei 1024 Breite, 48 Rand). */
export const BOARD_COLUMNS: TableColumn[] = [
  { header: "kiosk.colCourt", x: 48 },
  { header: "kiosk.colTime", x: 168 },
  { header: "kiosk.colMatch", x: 300 },
  { header: "kiosk.colEvent", x: 760 },
];

export const MAX_TABLE_ROWS = 9;

function matchup(m: WaidcupLiveMatch): string {
  return `${m.side1Names.join("/")} vs ${m.side2Names.join("/")}`;
}

function matchRow(m: WaidcupLiveMatch): string[] {
  return [m.court, m.scheduledTime, matchup(m), m.eventName];
}

function tableModel(title: string, theme: "dark" | "light", matches: WaidcupLiveMatch[], t: Translate): ScreenModel {
  const columns = BOARD_COLUMNS.map((c) => ({ ...c, header: t(c.header) }));
  if (matches.length === 0) {
    return { title, theme, layout: "table", columns, rows: [], note: t("orderOfPlay.empty") };
  }
  const rows = matches.slice(0, MAX_TABLE_ROWS).map(matchRow);
  const overflow = matches.length - rows.length;
  return { title, theme, layout: "table", columns, rows, note: overflow > 0 ? `+${overflow}` : undefined };
}

export function buildLocationModel(t: Translate): ScreenModel {
  const textLines: TextLine[] = [
    ...WAIDCUP_ADDRESS_LINES.map((text) => ({ text, emphasis: true })),
    { text: "" },
    { text: t("location.transitTitle"), emphasis: true },
    { text: t("location.transitText") },
    { text: "" },
    { text: t("location.parkingTitle"), emphasis: true },
    { text: t("location.parkingText") },
  ];
  return { title: t("nav.location"), theme: "dark", layout: "text", textLines };
}

export function buildInfosModel(t: Translate): ScreenModel {
  const textLines: TextLine[] = [
    { text: t("infos.dateDurationLabel"), emphasis: true },
    { text: t("infos.dateDurationValue") },
    { text: t("infos.dateFinalLabel"), emphasis: true },
    { text: t("infos.dateFinalValue") },
    { text: "" },
    { text: t("infos.tableauxTitle"), emphasis: true },
    { text: `${t("infos.tableau32")} · ${t("infos.tableau16")}` },
    { text: "" },
    { text: t("infos.hintsTitle"), emphasis: true },
    { text: t("infos.hint1") },
  ];
  return { title: t("nav.infos"), theme: "dark", layout: "text", textLines };
}

export function buildOrderOfPlayModel(matches: WaidcupLiveMatch[], t: Translate): ScreenModel {
  return tableModel(t("nav.orderOfPlay"), "dark", matches, t);
}

export function buildLiveModel(live: WaidcupLiveResponse, t: Translate): ScreenModel {
  return tableModel(t("nav.live"), "light", [...live.now, ...live.upcoming], t);
}
```

- [ ] **Step 7: Test ausführen (muss bestehen)**

Run: `npm -w @tcw/waidcup-public run test`
Expected: PASS (6 Tests grün)

- [ ] **Step 8: Commit**

```bash
git add apps/waidcup-public/package.json package.json apps/waidcup-public/src/features/tour/address.ts apps/waidcup-public/src/features/tour/screenModel.ts apps/waidcup-public/src/features/tour/screenModel.test.ts
git commit -m "feat(waidcup): Test-Harness + reine Screen-Model-Builder für die 3D-Tour"
```

---

## Task 3: Canvas-Painter

**Files:**
- Create: `apps/waidcup-public/src/features/tour/screenPainter.ts`

**Interfaces:**
- Consumes: `ScreenModel`, `TextLine`, `TableColumn` aus `./screenModel.js`.
- Produces:
  - `const SCREEN_W = 1024`, `const SCREEN_H = 576`
  - `createScreenCanvas(): HTMLCanvasElement` (1024×576)
  - `paintScreen(canvas: HTMLCanvasElement, model: ScreenModel): void`

Rein visuell verifiziert (kein Unit-Test — Canvas-2D fehlt im Node-Testlauf).

- [ ] **Step 1: Painter implementieren**

Create `apps/waidcup-public/src/features/tour/screenPainter.ts`:

```ts
/**
 * Zeichnet ein ScreenModel als „Anzeigetafel" auf ein 1024×576-Canvas, das die
 * 3D-App als Textur auf einen In-World-Screen legt. Zwei Layouts: Fliesstext
 * (Standort/Infos) und Match-Tabelle (Order of Play/Live). Bewusst schlicht und
 * kontraststark für gute Lesbarkeit aus der Distanz in der 3D-Szene.
 */
import type { ScreenModel, TextLine } from "./screenModel.js";

export const SCREEN_W = 1024;
export const SCREEN_H = 576;
const PAD = 48;
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

interface Palette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  rule: string;
}

const DARK: Palette = { bg: "#0d1420", fg: "#f2f5fb", muted: "#9fb0c8", accent: "#7fc4ff", rule: "#26364d" };
const LIGHT: Palette = { bg: "#f7f9fc", fg: "#101722", muted: "#4a5666", accent: "#0a66c2", rule: "#d3dae4" };

export function createScreenCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  return canvas;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (text === "") return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function paintHeader(ctx: CanvasRenderingContext2D, model: ScreenModel, p: Palette): number {
  ctx.fillStyle = p.accent;
  ctx.font = `700 44px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(model.title, PAD, PAD + 40);
  ctx.strokeStyle = p.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD + 60);
  ctx.lineTo(SCREEN_W - PAD, PAD + 60);
  ctx.stroke();
  return PAD + 108; // y-Start des Inhalts
}

function paintText(ctx: CanvasRenderingContext2D, model: ScreenModel, p: Palette, startY: number): void {
  let y = startY;
  const maxWidth = SCREEN_W - 2 * PAD;
  for (const line of model.textLines ?? ([] as TextLine[])) {
    ctx.fillStyle = line.emphasis ? p.fg : p.muted;
    ctx.font = `${line.emphasis ? "600" : "400"} 26px ${FONT}`;
    for (const wrapped of wrap(ctx, line.text, maxWidth)) {
      ctx.fillText(wrapped, PAD, y);
      y += 36;
    }
  }
}

function paintTable(ctx: CanvasRenderingContext2D, model: ScreenModel, p: Palette, startY: number): void {
  const columns = model.columns ?? [];
  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = p.muted;
  for (const col of columns) ctx.fillText(col.header, col.x, startY);
  let y = startY + 40;
  ctx.font = `400 24px ${FONT}`;
  for (const row of model.rows ?? []) {
    ctx.fillStyle = p.fg;
    row.forEach((cell, i) => {
      const col = columns[i];
      if (!col) return;
      const next = columns[i + 1];
      const maxWidth = (next ? next.x : SCREEN_W - PAD) - col.x - 12;
      ctx.fillText(ellipsize(ctx, cell, maxWidth), col.x, y);
    });
    y += 42;
  }
  if (model.note) {
    ctx.fillStyle = p.muted;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText(model.note, PAD, SCREEN_H - PAD);
  }
}

export function paintScreen(canvas: HTMLCanvasElement, model: ScreenModel): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const p = model.theme === "light" ? LIGHT : DARK;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const startY = paintHeader(ctx, model, p);
  if (model.layout === "text") paintText(ctx, model, p, startY);
  else paintTable(ctx, model, p, startY);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm -w @tcw/waidcup-public run build 2>&1 | head -20`
Expected: kein TypeScript-Fehler im Painter (Build darf an fehlenden späteren Dateien noch scheitern — dieser Task fügt nur den Painter hinzu; achte nur darauf, dass `screenPainter.ts` selbst fehlerfrei ist). Falls andere Fehler auftauchen, ignoriere sie hier.

- [ ] **Step 3: Commit**

```bash
git add apps/waidcup-public/src/features/tour/screenPainter.ts
git commit -m "feat(waidcup): Canvas-Painter für die 3D-Tour-Screens"
```

---

## Task 4: Mobile-Hook + Nav-Filter (reine Logik TDD)

**Files:**
- Create: `apps/waidcup-public/src/app/navFilter.ts`
- Test: `apps/waidcup-public/src/app/navFilter.test.ts`
- Create: `apps/waidcup-public/src/hooks/useIsMobile.ts`

**Interfaces:**
- Consumes: `NavItem`, `MainView` aus `./navigation.js`.
- Produces:
  - `filterNavForViewport(items: readonly NavItem[], isMobile: boolean): NavItem[]` — entfernt den `"tour"`-Eintrag, wenn `isMobile`.
  - `const MOBILE_QUERY = "(max-width: 720px)"`
  - `useIsMobile(): boolean`

- [ ] **Step 1: Failing test schreiben**

Create `apps/waidcup-public/src/app/navFilter.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { NavItem } from "./navigation.js";
import { filterNavForViewport } from "./navFilter.js";

const ITEMS: NavItem[] = [
  { view: "location", labelKey: "nav.location" },
  { view: "tour", labelKey: "nav.tour" },
  { view: "live", labelKey: "nav.live" },
];

test("filterNavForViewport: Desktop behält alle Einträge inkl. tour", () => {
  const result = filterNavForViewport(ITEMS, false);
  assert.equal(result.length, 3);
  assert.ok(result.some((i) => i.view === "tour"));
});

test("filterNavForViewport: Mobile entfernt nur den tour-Eintrag", () => {
  const result = filterNavForViewport(ITEMS, true);
  assert.equal(result.length, 2);
  assert.ok(!result.some((i) => i.view === "tour"));
  assert.ok(result.some((i) => i.view === "live"));
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npm -w @tcw/waidcup-public run test`
Expected: FAIL („Cannot find module './navFilter.js'"). Hinweis: `NavItem` muss `"tour"` als gültigen `view` akzeptieren — das kommt aus Task 7. Bis dahin verwendet der Test das Objektliteral; falls der Testlauf hier einen Typfehler auf `"tour"` wirft, ist das erwartet und wird in Task 7 aufgelöst. Der `node --test`-Lauf via tsx führt trotz Typfehler aus (tsx transpiliert ohne Typecheck), sodass der Test wie beschrieben zuerst am fehlenden Modul scheitert.

- [ ] **Step 3: Nav-Filter implementieren**

Create `apps/waidcup-public/src/app/navFilter.ts`:

```ts
/**
 * Blendet den 3D-Tour-Tab auf schmalen (mobilen) Viewports aus – der Rundgang
 * braucht Maus und Pointer-Lock und ist auf Touch nicht sinnvoll bedienbar.
 */
import type { NavItem } from "./navigation.js";

export function filterNavForViewport(items: readonly NavItem[], isMobile: boolean): NavItem[] {
  return items.filter((item) => !(isMobile && item.view === "tour"));
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npm -w @tcw/waidcup-public run test`
Expected: PASS (alle Tests grün)

- [ ] **Step 5: Mobile-Hook implementieren**

Create `apps/waidcup-public/src/hooks/useIsMobile.ts`:

```ts
/**
 * Meldet, ob der Viewport „mobil" (≤ 720px) ist. Reagiert live auf Grössen-
 * änderungen via matchMedia. Erste Mobile-Erkennung des Waidcup-Frontends.
 */
import { useEffect, useState } from "react";

export const MOBILE_QUERY = "(max-width: 720px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const onChange = (event: MediaQueryListEvent): void => setIsMobile(event.matches);
    media.addEventListener("change", onChange);
    setIsMobile(media.matches);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/waidcup-public/src/app/navFilter.ts apps/waidcup-public/src/app/navFilter.test.ts apps/waidcup-public/src/hooks/useIsMobile.ts
git commit -m "feat(waidcup): Mobile-Viewport-Hook + Nav-Filter für den 3D-Tour-Tab"
```

---

## Task 5: Screen-Driver (Mapping TDD + Hook)

**Files:**
- Create: `apps/waidcup-public/src/features/tour/screenDriver.ts`
- Test: `apps/waidcup-public/src/features/tour/screenDriver.test.ts`

**Interfaces:**
- Consumes: `waidcupApi` aus `../../api/client.js`; `paintScreen`, `createScreenCanvas` aus `./screenPainter.js`; Model-Builder aus `./screenModel.js`.
- Produces:
  - `type ScreenKind = "location" | "infos" | "orderofplay" | "live"`
  - `const SCREEN_INDEX: Record<ScreenKind, number>` = `{ location: 0, infos: 1, orderofplay: 2, live: 3 }`
  - `interface TcwScreenApi { setScreen(index: number, source: HTMLCanvasElement | null): void }`
  - `useScreenDriver(getWindow: () => Window | null, t: (key: string) => string, active: boolean): void`

- [ ] **Step 1: Failing test schreiben**

Create `apps/waidcup-public/src/features/tour/screenDriver.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCREEN_INDEX } from "./screenDriver.js";

test("SCREEN_INDEX bildet die vier Screens auf die 3D-Indizes 0..3 ab", () => {
  assert.equal(SCREEN_INDEX.location, 0);
  assert.equal(SCREEN_INDEX.infos, 1);
  assert.equal(SCREEN_INDEX.orderofplay, 2);
  assert.equal(SCREEN_INDEX.live, 3);
});
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npm -w @tcw/waidcup-public run test`
Expected: FAIL („Cannot find module './screenDriver.js'")

- [ ] **Step 3: Driver implementieren**

Create `apps/waidcup-public/src/features/tour/screenDriver.ts`:

```ts
/**
 * Bespielt die vier In-World-Screens der 3D-App vom Waidcup-Host aus. Wartet auf
 * das von der 3D-App exponierte window.__tcw (same-origin im iframe), malt pro
 * Screen ein Canvas und ruft __tcw.setScreen(index, canvas). Standort/Infos
 * werden einmalig gesetzt, Order of Play und Live alle 20 s neu gemalt.
 */
import { useEffect } from "react";
import { waidcupApi } from "../../api/client.js";
import {
  buildInfosModel,
  buildLiveModel,
  buildLocationModel,
  buildOrderOfPlayModel,
} from "./screenModel.js";
import { createScreenCanvas, paintScreen } from "./screenPainter.js";

export type ScreenKind = "location" | "infos" | "orderofplay" | "live";

export const SCREEN_INDEX: Record<ScreenKind, number> = {
  location: 0,
  infos: 1,
  orderofplay: 2,
  live: 3,
};

export interface TcwScreenApi {
  setScreen(index: number, source: HTMLCanvasElement | null): void;
}

const REFRESH_MS = 20_000;
const READY_POLL_MS = 250;
const READY_TIMEOUT_MS = 20_000;

type Translate = (key: string) => string;

function tcwOf(win: Window | null): TcwScreenApi | null {
  const api = (win as unknown as { __tcw?: TcwScreenApi } | null)?.__tcw;
  return api && typeof api.setScreen === "function" ? api : null;
}

/** Malt ein Model in ein (wiederverwendetes) Canvas und legt es auf den Screen. */
function push(tcw: TcwScreenApi, index: number, canvas: HTMLCanvasElement, model: Parameters<typeof paintScreen>[1]): void {
  paintScreen(canvas, model);
  tcw.setScreen(index, canvas);
}

export function useScreenDriver(getWindow: () => Window | null, t: Translate, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let readyTimer: ReturnType<typeof setInterval> | null = null;

    const oopCanvas = createScreenCanvas();
    const liveCanvas = createScreenCanvas();

    async function refreshDynamic(tcw: TcwScreenApi): Promise<void> {
      try {
        const [oop, live] = await Promise.all([waidcupApi.orderOfPlay(), waidcupApi.live()]);
        if (cancelled) return;
        push(tcw, SCREEN_INDEX.orderofplay, oopCanvas, buildOrderOfPlayModel(oop.today, t));
        push(tcw, SCREEN_INDEX.live, liveCanvas, buildLiveModel(live, t));
      } catch {
        // Netz-/API-Fehler: Screens behalten ihren letzten Stand, kein Absturz.
      }
    }

    async function start(tcw: TcwScreenApi): Promise<void> {
      await (document.fonts?.ready ?? Promise.resolve());
      if (cancelled) return;
      push(tcw, SCREEN_INDEX.location, createScreenCanvas(), buildLocationModel(t));
      push(tcw, SCREEN_INDEX.infos, createScreenCanvas(), buildInfosModel(t));
      await refreshDynamic(tcw);
      if (cancelled) return;
      refreshTimer = setInterval(() => {
        const current = tcwOf(getWindow());
        if (current) void refreshDynamic(current);
      }, REFRESH_MS);
    }

    const deadline = Date.now() + READY_TIMEOUT_MS;
    readyTimer = setInterval(() => {
      const tcw = tcwOf(getWindow());
      if (tcw) {
        if (readyTimer) clearInterval(readyTimer);
        readyTimer = null;
        void start(tcw);
      } else if (Date.now() > deadline && readyTimer) {
        clearInterval(readyTimer);
        readyTimer = null; // 3D-App ohne Screen-API: Tour läuft, Screens bleiben dunkel.
      }
    }, READY_POLL_MS);

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      if (readyTimer) clearInterval(readyTimer);
    };
  }, [getWindow, t, active]);
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npm -w @tcw/waidcup-public run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/waidcup-public/src/features/tour/screenDriver.ts apps/waidcup-public/src/features/tour/screenDriver.test.ts
git commit -m "feat(waidcup): Screen-Driver bespielt die 3D-Screens per __tcw.setScreen"
```

---

## Task 6: TourView (Start-Button + iframe)

**Files:**
- Create: `apps/waidcup-public/src/features/tour/TourView.tsx`

**Interfaces:**
- Consumes: `useI18n` aus `@tcw/tournament-ui`; `useScreenDriver` aus `./screenDriver.js`.
- Produces: `export function TourView(): JSX.Element`.

Verhalten: Vor Start Titel + Button „3D Tour starten". Nach Klick `<iframe src="/tcw3d/index.html" allow="pointer-lock; fullscreen">`; der Driver wird mit `getWindow = () => iframeRef.current?.contentWindow ?? null` und `active = started` gestartet. iframe-Fehler → Hinweis + erneuter Start.

- [ ] **Step 1: TourView implementieren**

Create `apps/waidcup-public/src/features/tour/TourView.tsx`:

```tsx
/**
 * „3D Tour"-Tab: zeigt zuerst nur einen Start-Button (der 22-MB-Rundgang und der
 * Pointer-Lock sollen erst auf ausdrückliche Nutzergeste laden). Nach dem Start
 * läuft die 3D-App in einem iframe; useScreenDriver bespielt ihre vier Screens.
 */
import { useCallback, useRef, useState, type JSX } from "react";
import { useI18n } from "@tcw/tournament-ui";
import { useScreenDriver } from "./screenDriver.js";

export function TourView(): JSX.Element {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const getWindow = useCallback(() => iframeRef.current?.contentWindow ?? null, []);
  useScreenDriver(getWindow, t, started && !failed);

  if (!started) {
    return (
      <section className="tour tour--intro">
        <h2 className="tour__title">{t("nav.tour")}</h2>
        <p className="tour__lead">{t("tour.startHint")}</p>
        <button type="button" className="tour__start" onClick={() => setStarted(true)}>
          {t("tour.start")}
        </button>
      </section>
    );
  }

  return (
    <section className="tour tour--running">
      {failed ? (
        <div className="tour__error">
          <p>{t("tour.loadError")}</p>
          <button type="button" className="tour__start" onClick={() => setFailed(false)}>
            {t("tour.start")}
          </button>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className="tour__frame"
          src="/tcw3d/index.html"
          title={t("nav.tour")}
          allow="pointer-lock; fullscreen"
          onError={() => setFailed(true)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Styles ergänzen**

In `apps/waidcup-public/src/styles/waidcup.css` am Dateiende anhängen:

```css
/* 3D-Tour */
.tour--intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 1rem;
  text-align: center;
}
.tour__start {
  padding: 0.9rem 1.8rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  background: var(--accent, #0a66c2);
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
.tour__start:hover {
  filter: brightness(1.08);
}
.tour--running {
  padding: 0;
}
.tour__frame {
  display: block;
  width: 100%;
  height: min(78vh, 820px);
  border: 0;
  border-radius: 12px;
  background: #0d1420;
}
.tour__error {
  padding: 3rem 1rem;
  text-align: center;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/waidcup-public/src/features/tour/TourView.tsx apps/waidcup-public/src/styles/waidcup.css
git commit -m "feat(waidcup): TourView mit Start-Button und 3D-iframe"
```

---

## Task 7: Navigation, Routing, i18n verdrahten

**Files:**
- Modify: `apps/waidcup-public/src/app/navigation.ts`
- Modify: `apps/waidcup-public/src/App.tsx`
- Modify: `apps/waidcup-public/src/components/SiteChrome.tsx`
- Modify: `apps/waidcup-public/public/i18n/de.json`, `en.json`, `fr.json`, `it.json`

**Interfaces:**
- Consumes: `TourView` (Task 6), `filterNavForViewport` + `useIsMobile` (Task 4).
- Produces: `"tour"` als gültiger `MainView`; Tab am Ende der Leiste (Desktop) bzw. ausgeblendet (Mobile).

- [ ] **Step 1: `MainView` + `NAV_ITEMS` erweitern**

In `apps/waidcup-public/src/app/navigation.ts`:
- Zeile 5 (`MAIN_VIEWS`) um `"tour"` am Ende ergänzen:

```ts
export const MAIN_VIEWS = ["location", "infos", "brackets", "matches", "orderofplay", "live", "webcam", "tour"] as const;
```

- In `NAV_ITEMS` nach dem `webcam`-Eintrag ergänzen:

```ts
  { view: "tour", labelKey: "nav.tour" },
```

- [ ] **Step 2: Routing-Case in App.tsx ergänzen**

In `apps/waidcup-public/src/App.tsx`:
- Import ergänzen (bei den übrigen Feature-Imports):

```ts
import { TourView } from "./features/tour/TourView.js";
```

- Im `switch` von `ActiveView` vor `default` ergänzen:

```tsx
    case "tour":
      return <TourView />;
```

- [ ] **Step 3: TabBar mobil filtern**

In `apps/waidcup-public/src/components/SiteChrome.tsx`:
- Imports oben ergänzen:

```ts
import { NAV_ITEMS, type MainView } from "../app/navigation.js";
import { filterNavForViewport } from "../app/navFilter.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
```

(die bestehende `NAV_ITEMS`-Importzeile ersetzen, damit kein Doppelimport entsteht)

- In `TabBar` vor dem `return` ergänzen und beim Mappen `NAV_ITEMS` durch die gefilterte Liste ersetzen:

```tsx
  const isMobile = useIsMobile();
  const items = filterNavForViewport(NAV_ITEMS, isMobile);
```

```tsx
        {items.map((item) => (
```

- [ ] **Step 4: i18n-Keys ergänzen**

In allen vier Dateien unter `public/i18n/` jeweils `nav.webcam` gefolgt von den neuen Keys ergänzen.

`de.json` — nach `"nav.webcam": "Webcam",`:

```json
  "nav.tour": "3D Tour",
  "tour.start": "3D Tour starten",
  "tour.startHint": "Lauf virtuell durch die Anlage. Der Rundgang benötigt Maus und Tastatur.",
  "tour.loadError": "Der 3D-Rundgang konnte nicht geladen werden.",
```

`en.json`:

```json
  "nav.tour": "3D Tour",
  "tour.start": "Start 3D tour",
  "tour.startHint": "Walk through the club virtually. The tour needs a mouse and keyboard.",
  "tour.loadError": "The 3D tour could not be loaded.",
```

`fr.json`:

```json
  "nav.tour": "Visite 3D",
  "tour.start": "Démarrer la visite 3D",
  "tour.startHint": "Parcourez le club virtuellement. La visite nécessite une souris et un clavier.",
  "tour.loadError": "La visite 3D n'a pas pu être chargée.",
```

`it.json`:

```json
  "nav.tour": "Tour 3D",
  "tour.start": "Avvia il tour 3D",
  "tour.startHint": "Esplora il club virtualmente. Il tour richiede mouse e tastiera.",
  "tour.loadError": "Impossibile caricare il tour 3D.",
```

Achte in jeder Datei auf gültiges JSON (Komma nach der vorherigen Zeile, keine Zeile nach der letzten Eigenschaft mit Komma).

- [ ] **Step 5: Tests + Typecheck**

Run: `npm -w @tcw/waidcup-public run test && npm -w @tcw/waidcup-public run build`
Expected: Tests grün; `tsc -b && vite build` ohne Fehler. Prüfe, dass `public/i18n/*.json` valide sind (Build bricht sonst nicht ab, aber ein JSON-Lint hilft: `node -e "for (const f of ['de','en','fr','it']) require('./apps/waidcup-public/public/i18n/'+f+'.json')"` → keine Ausgabe = ok).

- [ ] **Step 6: Commit**

```bash
git add apps/waidcup-public/src/app/navigation.ts apps/waidcup-public/src/App.tsx apps/waidcup-public/src/components/SiteChrome.tsx apps/waidcup-public/public/i18n
git commit -m "feat(waidcup): 3D-Tour-Tab in Navigation, Routing und i18n verdrahten"
```

---

## Task 8: Build-Verifikation + manuelle Abnahme

**Files:** keine neuen — Gesamtabnahme.

- [ ] **Step 1: Volle Test-Suite**

Run: `npm test`
Expected: alle Pakete inkl. `@tcw/waidcup-public` grün.

- [ ] **Step 2: Produktion bauen**

Run: `npm -w @tcw/waidcup-public run build`
Expected: `dist/` erzeugt; `dist/tcw3d/index.html` vorhanden (`test -f apps/waidcup-public/dist/tcw3d/index.html && echo OK` → `OK`).

- [ ] **Step 3: Lokal starten und manuell prüfen**

Run: `npm run dev:waidcup` (Frontend auf Port 5176, API auf 8096).
Manuell im Browser (Desktop-Breite > 720px):
- Tab „3D Tour" erscheint in der Leiste (ganz rechts).
- Fenster < 720px verkleinern → Tab verschwindet; wieder vergrössern → Tab kommt zurück.
- Tab öffnen → nur Button „3D Tour starten" sichtbar.
- Button klicken → 3D-Rundgang lädt; mit Maus/WASD bewegbar (Pointer-Lock).
- Zu den vier Terrassen-Screens laufen: Screen 1 = Adresse (ohne Karte), Screen 2 = Infos, Screen 3 = Order of Play (heute), Screen 4 = Live (heller Hintergrund).
- Tab wechseln (weg von 3D Tour) → iframe verschwindet, Maus wieder frei.

- [ ] **Step 4: Abschluss-Notiz**

Kein Code-Commit nötig, falls alles grün. Andernfalls Findings als eigene Commits nachziehen.

---

## Self-Review-Ergebnis (vom Planautor)

- **Spec-Abdeckung:** Tab desktop-only (Task 4+7), Start-Button-Gating (Task 6), Screen 1 Adresse ohne Karte (Task 2 `buildLocationModel` + `address.ts`), Screen 2 Infos (Task 2), Screen 3 Order of Play (Task 2+5), Screen 4 Live-Light (Task 2 `buildLiveModel` theme=light), Vendoring+Sync (Task 1), same-origin `__tcw`-Zugriff ohne 3DTCW-Änderung (Task 5). Alle Spec-Punkte haben eine Task.
- **Platzhalter:** keine — jeder Code-Step enthält vollständigen Code.
- **Typkonsistenz:** `ScreenModel`/`TextLine`/`TableColumn` in Task 2 definiert, in Task 3/5 identisch konsumiert; `SCREEN_INDEX`-Keys = `ScreenKind`; `useScreenDriver`-Signatur in Task 5 definiert und in Task 6 exakt so aufgerufen; `filterNavForViewport` Signatur Task 4 = Aufruf Task 7.
- **Offener Übergang:** In Task 4 referenziert der Test `view: "tour"`, das erst in Task 7 ein gültiger `MainView` wird. Bewusst dokumentiert (tsx transpiliert ohne Typecheck, Test läuft); nach Task 7 ist auch der Typ sauber.
