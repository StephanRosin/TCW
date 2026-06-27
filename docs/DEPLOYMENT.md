# Deployment – Server (Parallelbetrieb zum Altsystem)

Der Neubau läuft auf dem Server **parallel** zur bestehenden Interclub-App
(8090/8091) unter zwei freien Ports und mit **eigener Datenbank** – das
Altsystem bleibt unberührt.

> Hinweis: `<MAC_MINI_LAN_IP>` ist ein Platzhalter für die lokale LAN-Adresse des
> Server (nicht im Repo hinterlegt). Beim Ausführen der Befehle entsprechend
> ersetzen.

## Übersicht

| Dienst | Port | LaunchAgent | URL (LAN) |
| --- | --- | --- | --- |
| Public | 8092 | `ch.tcw.ic-claude-public` | <http://<MAC_MINI_LAN_IP>:8092> |
| Admin | 8093 | `ch.tcw.ic-claude-admin` | <http://<MAC_MINI_LAN_IP>:8093> |

- **App-Verzeichnis:** `<APP_DIR>`
- **Datenbank (eigen):** `<APP_DIR>/data/ic_teams.sqlite`
  (Kopie der Live-Daten; das Altsystem schreibt hier nicht hinein).
- **Node-Runtime (nutzer-lokal):** `~/.local/node22` (Node 22 LTS, kein sudo).
- **Logs:** `…/logs/public.out.log`, `…/logs/public.err.log`,
  `…/logs/admin.out.log`, `…/logs/admin.err.log`.
- **Start-Wrapper:** `…/bin/run-public.sh`, `…/bin/run-admin.sh` (setzen PATH,
  Ports, DB-Pfad und starten den Server via `tsx`).
- Beide LaunchAgents: `RunAtLoad` + `KeepAlive` (Autostart, Neustart bei Absturz).
- Der Admin-Prozess führt die **Hintergrund-Jobs** aus (stündlicher
  ClubResult-Import der Spieltermine, Turnier-Polling – je mit Jitter).

## Betrieb

```bash
# Status
launchctl print gui/$(id -u)/ch.tcw.ic-claude-public | grep -E "state|pid|last exit code"
launchctl print gui/$(id -u)/ch.tcw.ic-claude-admin  | grep -E "state|pid|last exit code"

# Neustart
launchctl kickstart -k gui/$(id -u)/ch.tcw.ic-claude-public
launchctl kickstart -k gui/$(id -u)/ch.tcw.ic-claude-admin

# Stoppen / Entladen
launchctl bootout gui/$(id -u)/ch.tcw.ic-claude-public
launchctl bootout gui/$(id -u)/ch.tcw.ic-claude-admin

# Logs
tail -f <APP_DIR>/logs/admin.out.log
```

## Update (Code ändern)

1. Lokal Quellcode-Bundle bauen (ohne `node_modules`/`dist`/`data`-DB).
2. Per `scp` ins App-Verzeichnis übertragen, bei Frontend-Änderungen
   `export PATH="$HOME/.local/node22/bin:$PATH" && npm run build` auf dem Mac.
3. Betroffenen LaunchAgent per `launchctl kickstart -k …` neu starten.
4. Verifizieren (siehe Checks unten).

## Healthchecks / Akzeptanz (verifiziert)

```bash
curl http://<MAC_MINI_LAN_IP>:8092/api/health     # {"ok":true,"service":"public"}
curl http://<MAC_MINI_LAN_IP>:8093/api/health     # {"ok":true,"service":"admin"}
curl http://<MAC_MINI_LAN_IP>:8092/api/teams       # 14 Teams
curl http://<MAC_MINI_LAN_IP>:8092/api/matches     # Spieltermine + Stand
curl http://<MAC_MINI_LAN_IP>:8092/api/tournaments # Waidcup/Clubmeisterschaft
# Security: DB/Quellcode/Logs müssen 404 liefern
curl -o /dev/null -w "%{http_code}\n" http://<MAC_MINI_LAN_IP>:8092/data/ic_teams.sqlite  # 404
```

## Sicherheit / Hinweise

- Public liefert nur das gebaute Frontend (`apps/web-public/dist`) und `/api/*`;
  alle übrigen Pfade (DB, Quellcode, Logs) → **404** (verifiziert).
- Der Admin (8093) ist im LAN ohne Login erreichbar (internes Werkzeug, wie das
  Altsystem). Für reinen LAN-Testbetrieb akzeptabel; vor einem produktiven
  Ersatz sollte der Admin auf `127.0.0.1` bzw. hinter eine Zugangskontrolle.
- Vor einem späteren echten Umschalten: DB frisch aus dem Livesystem ziehen und
  die alten LaunchAgents (8090/8091) kontrolliert deaktivieren, damit nicht zwei
  Systeme dieselben Quellen doppelt importieren.
