---
name: run-ic-webseite-claude
description: Build, run, and drive the TCW Spielbetrieb 2026 web app (IC_Webseite_Claude). Use when asked to start the IC/Interclub/Turnier site, run its dev servers, take a screenshot of the public or admin UI, click through it, or run its tests.
---

TCW Spielbetrieb 2026 is an npm-workspaces monorepo: two Fastify APIs
(public `8090`, admin `8091`) plus two React/Vite SPAs (public `5173`,
admin `5174`). The human path is `npm run dev` + a browser. The **agent
path** is: `npm run dev` in the background, then drive headless Chromium
with `.claude/skills/run-ic-webseite-claude/driver.mjs` — a
dependency-free CDP driver (no Playwright, no chromium-cli). Screenshots
land in `.claude/skills/run-ic-webseite-claude/screenshots/`.

All paths below are relative to the unit root
`/home/stephan/Dokumente/IC_Webseite_Claude/`.

## Prerequisites

- **Node >= 22** (this machine has v26; works fine).
- **A chromium binary.** Already present here as `/usr/bin/chromium`
  (Arch `chromium` package). The driver shells out to `chromium` by
  default; override with `CHROMIUM_BIN`. On a Debian/Ubuntu container
  you'd `apt-get install -y chromium` first — not needed on this host.

No `apt-get` was required on this machine.

## Setup

Dependencies are already installed (`node_modules/` present). From a
clean clone you would run:

```bash
npm install
```

Build the SQLite DB (idempotent, makes a timestamped backup under
`data/backups/` first):

```bash
npm run migrate
```

### Env vars (all optional for local runs)

| Variable | Default | Note |
| --- | --- | --- |
| `IC_DB_PATH` | `data/ic_teams.sqlite` | DB location |
| `IC_PUBLIC_PORT` / `IC_ADMIN_PORT` | `8090` / `8091` | API ports |
| `IC_ENABLE_JOBS` | `true` | **Admin server polls live Swisstennis on a schedule.** Set `IC_ENABLE_JOBS=false` for an offline/clean local run. |
| `IC_ADMIN_USER` / `IC_ADMIN_PASSWORD` | unset | When unset the admin API runs **without auth** (fine locally). |

## Run (agent path)

### 1. Start the dev servers in the background

```bash
cd /home/stephan/Dokumente/IC_Webseite_Claude
npm run dev > /tmp/ic-dev.log 2>&1 &
```

`npm run dev` launches all four processes (public-api, admin-api,
public-web, admin-web) via `concurrently`. Wait for them to actually
serve — poll, don't sleep:

```bash
timeout 40 bash -c 'until curl -sf http://localhost:5173 >/dev/null && curl -sf http://localhost:5174 >/dev/null; do sleep 1; done'
curl -sf http://localhost:8090/api/health   # {"ok":true,"service":"public",...}
curl -sf http://localhost:8091/api/health   # {"ok":true,"service":"admin",...}
```

### 2. Drive it with the CDP driver

Pipe a newline-separated script to `driver.mjs`. It launches its own
headless Chromium, runs the commands, and writes PNGs to
`.claude/skills/run-ic-webseite-claude/screenshots/` (latest also copied
to `screenshots/latest.png`).

Public site — home + a real interaction (switch to the Turniere tab):

```bash
node .claude/skills/run-ic-webseite-claude/driver.mjs <<'EOF'
nav http://localhost:5173
wait-for text=Teams
screenshot public-home
click button:has-text(Turniere)
wait-for text=Waidcup
screenshot public-turniere
console-errors
EOF
```

Admin site — wait for **data**, not just the shell (see Gotchas):

```bash
node .claude/skills/run-ic-webseite-claude/driver.mjs <<'EOF'
nav http://localhost:5174
wait-for text=NLC
screenshot admin-home
console-errors
EOF
```

### Driver commands

`nav <url>` · `wait-for <sel>` · `click <sel>` · `fill <sel> <value>` ·
`type <text>` · `eval <js>` · `text <sel>` · `screenshot [name]` ·
`console-errors` · `sleep <ms>`.

Selectors: plain CSS, or `text=<substring>`, or `<css>:has-text(<substring>)`.
`fill` uses the React native-value-setter trick so controlled inputs see
the change. Env: `CHROMIUM_BIN`, `CDP_PORT` (default 9333), `CDP_WIDTH`,
`CDP_HEIGHT`.

### 3. Stop

```bash
pkill -f 'concurrently' ; pkill -f 'vite' ; pkill -f 'tsx watch'
```

## Run (human path)

```bash
npm run dev   # then open http://localhost:5173 (public) / :5174 (admin)
```

Useless headless — it just waits and serves. Use the driver instead.

## Test / checks

```bash
npm run test        # @tcw/core unit tests (domain + mappers)
npm run typecheck   # tsc over packages/shared + packages/core
npm run lint        # eslint flat config
```

## Other useful commands

```bash
npm run import:live           # pull a read-only snapshot from the live admin API (needs network)
npm run refresh:tournaments   # refresh Swisstennis tournament data (needs network)
```

## Gotchas

- **No `chromium-cli` / Playwright on this machine.** That's why the
  driver is a hand-rolled CDP client over the system `chromium`. It
  launches with `--headless=new --no-sandbox --disable-dev-shm-usage`.
- **Admin shell renders before its data.** `wait-for text=Teams` matches
  the nav tab instantly while the body still shows "Lädt…", so a
  screenshot taken then is empty. Wait for actual content
  (`wait-for text=NLC` or another team/league label) instead.
- **Nav tabs are `<button>`, and `text=Turniere` matches a container div
  first** (clicking it does nothing). Use `click button:has-text(Turniere)`
  to hit the actual tab. The header language switches are also buttons
  (`button:has-text(English)`).
- **`IC_ENABLE_JOBS` defaults to `true`** → the admin server starts
  background pollers that hit live Swisstennis on launch. Harmless, but
  set `IC_ENABLE_JOBS=false` if you want a fully offline run.
- **Admin API binds `127.0.0.1` only** (`IC_ADMIN_HOST` default). Reach
  it via `localhost`/`127.0.0.1`, and via the Vite proxy at
  `http://localhost:5174/api/...`. The public API binds `0.0.0.0`.
- **`/dev/tcp` port checks fail in this session's shell** (zsh snapshot,
  not bash). Use `curl` to probe ports.
- **First Vite paint can take a few seconds** while it re-optimizes deps;
  `wait-for` handles it, a bare `sleep` may not.

## Troubleshooting

- **`EADDRINUSE` on relaunch** — a previous `npm run dev` is still up.
  `pkill -f 'concurrently'; pkill -f vite; pkill -f 'tsx watch'`, then
  restart.
- **Driver: "Chromium DevTools endpoint never came up"** — `chromium`
  not found or `CDP_PORT` already taken. Check `which chromium` (set
  `CHROMIUM_BIN`) or pass a different `CDP_PORT`.
- **Blank / "Lädt…" screenshot** — you screenshotted before data loaded.
  Add a `wait-for` on real content (not a nav label) before the shot.
- **Tournaments tab empty** — DB has no tournament rows. Run
  `npm run refresh:tournaments` (needs network); the seeded DB here
  already had Waidcup + Clubmeisterschaft.
