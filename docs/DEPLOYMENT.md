# Deployment – Server (Parallelbetrieb zum Altsystem)

Der Neubau läuft auf dem Server **parallel** zur bestehenden Interclub-App
(8090/8091) als **drei Dienste** auf eigenen Ports und mit **eigener Datenbank** –
das Altsystem bleibt unberührt.

> Hinweis: `<MAC_MINI_LAN_IP>` ist ein Platzhalter für die lokale LAN-Adresse des
> Server (nicht im Repo hinterlegt). Beim Ausführen der Befehle entsprechend
> ersetzen.

## Übersicht

| Dienst | Port | LaunchAgent | URL (LAN) |
| --- | --- | --- | --- |
| Public | 8092 | `ch.tcw.ic-claude-public` | <http://<MAC_MINI_LAN_IP>:8092> |
| Admin | 8093 | `ch.tcw.ic-claude-admin` | <http://<MAC_MINI_LAN_IP>:8093> |
| Waidcup | 8096 | `ch.tcw.waidcup-public` | <http://<MAC_MINI_LAN_IP>:8096> |

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

### Waidcup-Seite (eigenständige 3D-Tour-Website)

Die Waidcup-Seite (`apps/waidcup-server` + Frontend `apps/waidcup-public`) läuft
als **dritter Dienst** im **selben App-Verzeichnis**
`<APP_DIR>` (dasselbe Monorepo, dieselbe
`ic_teams.sqlite` **read-only**) – ein Prozess, ein Port.

- **LaunchAgent:** `ch.tcw.waidcup-public` (`RunAtLoad` + `KeepAlive`).
- **Port / URL:** `8096` → <http://<MAC_MINI_LAN_IP>:8096>.
- **Start-Wrapper:** `bin/run-waidcup.sh` (setzt PATH/Port/DB-Pfad, startet
  `waidcup-server` via `tsx` aus `src` – **kein Backend-Build nötig**).
- **Frontend:** `waidcup-server` liefert das gebaute `apps/waidcup-public/dist`
  (fastifyStatic) plus die API unter `/api/waidcup/*`. Frontend-Änderungen
  brauchen daher ein `vite build` (siehe „Update Waidcup"), Backend-Änderungen nur
  einen Neustart.
- **Logs:** `logs/waidcup.out.log`, `logs/waidcup.err.log`.
- **3D-Rundgang:** liegt als committeter Snapshot unter
  `apps/waidcup-public/public/tcw3d/` (aus dem separaten `3DTCW`-Repo). Lokal mit
  `npm run sync:tcw3d` aktualisieren; der Snapshot wird **mitcommittet** und
  einfach als statische Dateien mitdeployt (Mac ist file-synced, kein Git).

## Öffentlicher Zugang (Reverse Proxy)

Die LAN-Ports oben sind die **Origins**. Nach aussen ist die Waidcup-Seite
zusätzlich über eine öffentliche HTTPS-Domain erreichbar, die per Reverse Proxy
(**openresty/NGINX**) auf den Mac-Origin zeigt:

| Öffentliche URL | Origin |
| --- | --- |
| <https://waidcup.sterostxc.ch> | `http://<MAC_MINI_LAN_IP>:8096` |

- Die Proxy-Konfiguration liegt **ausserhalb dieses Repos** (auf dem
  Proxy-Host), nicht auf dem Mac.
- Der Origin sendet `Cache-Control: public, max-age=0` + ETag; der Proxy
  cached **nicht** stale → neue Deploys erscheinen bei normalem Reload (der
  Browser revalidiert per ETag). Kein Service Worker im Einsatz.
- **Troubleshooting „neue Version nicht sichtbar":** zuerst im
  **Inkognito-Fenster** prüfen. Erscheint es dort, ist es Browser-Cache (Hard-
  Reload/Cache leeren). Erscheint es dort ebenfalls nicht, am Origin (`:8096`)
  gegenprüfen, ob das erwartete Bundle ausgeliefert wird.
- **Namens-Konvention (Ad-Blocker):** Klassen/Dateien im Frontend nicht mit
  „sponsor"/„ad"/„banner" benennen – uBlock/AdBlock blenden solche Elemente/URLs
  generisch aus (Partner-Logo z. B. `header-partner` / `stadt-zuerich.png`).

## Betrieb

```bash
# Status
launchctl print gui/$(id -u)/ch.tcw.ic-claude-public | grep -E "state|pid|last exit code"
launchctl print gui/$(id -u)/ch.tcw.ic-claude-admin  | grep -E "state|pid|last exit code"
launchctl list | grep -i waidcup   # ch.tcw.waidcup-public: PID  Exit-Code  Label

# Neustart
launchctl kickstart -k gui/$(id -u)/ch.tcw.ic-claude-public
launchctl kickstart -k gui/$(id -u)/ch.tcw.ic-claude-admin
launchctl kickstart -k gui/$(id -u)/ch.tcw.waidcup-public

# Stoppen / Entladen
launchctl bootout gui/$(id -u)/ch.tcw.ic-claude-public
launchctl bootout gui/$(id -u)/ch.tcw.ic-claude-admin
launchctl bootout gui/$(id -u)/ch.tcw.waidcup-public

# Logs
tail -f <APP_DIR>/logs/admin.out.log
tail -f <APP_DIR>/logs/waidcup.out.log
```

## Update (Code ändern)

1. Lokal Quellcode-Bundle bauen (ohne `node_modules`/`dist`/`data`-DB).
2. Per `scp` ins App-Verzeichnis übertragen, bei Frontend-Änderungen
   `export PATH="$HOME/.local/node22/bin:$PATH" && npm run build` auf dem Mac.
3. Betroffenen LaunchAgent per `launchctl kickstart -k …` neu starten.
4. Verifizieren (siehe Checks unten).

## Update Waidcup (Code ändern)

SSH/SCP zum Mac läuft über **Passwort-Authentifizierung** (kein Key hinterlegt;
Passwort nicht im Repo). Konkreter Ablauf für eine Frontend-Änderung an der
Waidcup-Seite (z. B. den 3D-Tour-Screens):

1. **Lokal** testen und bauen:
   ```bash
   cd apps/waidcup-public
   npm test        # node --import tsx --test
   npm run build   # tsc -b && vite build
   ```
2. **Geänderte Quelldateien** per `scp` ins gleiche Pfadlayout unter
   `<APP_DIR>/` übertragen (nur die geänderten
   Dateien, z. B. `apps/waidcup-public/src/features/tour/*.ts(x)`). Bei
   3D-Rundgang-Updates den **ganzen** Snapshot `apps/waidcup-public/public/tcw3d/`
   übertragen (vorher lokal `npm run sync:tcw3d`).
3. **Auf dem Mac** das Frontend neu bauen (nur bei Frontend-Änderungen nötig;
   reine Backend-Änderungen an `waidcup-server` laufen via `tsx` ohne Build):
   ```bash
   export PATH="$HOME/.local/node22/bin:$PATH"
   cd <APP_DIR>/apps/waidcup-public && npm run build
   ```
4. **Dienst neu starten** (bei reinen `dist`-Änderungen streng genommen optional,
   da fastifyStatic sofort die neuen Dateien liefert – zur Sicherheit trotzdem):
   ```bash
   launchctl kickstart -k gui/$(id -u)/ch.tcw.waidcup-public
   ```
5. **Verifizieren:**
   ```bash
   curl http://<MAC_MINI_LAN_IP>:8096/api/health                 # {"ok":true,"service":"waidcup",…}
   curl http://<MAC_MINI_LAN_IP>:8096/api/waidcup/order-of-play   # {"today":[…]}
   curl -o /dev/null -w "%{http_code}\n" http://<MAC_MINI_LAN_IP>:8096/  # 200 (Frontend)
   ```

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
