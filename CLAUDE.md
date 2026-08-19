# TCW-Spielbetrieb und TCW-Waidcup

## Dokumentation

Die massgebliche Dokumentation dieses Projekts liegt **nicht in diesem Repository**, sondern im
gemeinsamen Obsidian-Vault:

    ~/Vault/10-Projekte/TCW/Spielbetrieb/Spielbetrieb.md` und `~/Vault/10-Projekte/TCW/Waidcup/Waidcup.md

Dort stehen Architektur, Datenmodell, Deployment, bekannte Fallen und die Begruendungen hinter den
Entscheidungen. Einstieg: `~/Vault/00-Start.md`.

Dieses Monorepo beherbergt **zwei** dokumentierte Anwendungen: den Spielbetrieb (Ports 8092/8093)
und den Waidcup (8096). Beide teilen sich Datenbank und Kernlogik.

## Pflegeregel

Jede Aenderung an dieser Anwendung wird **im selben Arbeitsgang** im Vault nachgefuehrt:
betroffene Seite(n) aktualisieren, `aktualisiert:` hochsetzen, committen. Die Aufgabe gilt erst
danach als erledigt.

Keine Passwoerter, Tokens oder Schluessel in den Vault schreiben — das Repository dort liegt auf
GitHub. Der Ablageort darf genannt werden, der Wert nicht.
