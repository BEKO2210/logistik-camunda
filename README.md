# Logistik-Camunda – Community-Spike (Demo)

> **Live Demo (Browser):** [https://beko2210.github.io/logistik-camunda/](https://beko2210.github.io/logistik-camunda/)  
> Interaktive BPMN-Prozesskarte mit Buchungspunkten und Engpass-Simulation — ohne Docker.


Kunden-Demo: Ende-zu-Ende-Logistik-/Fertigungsprozess mit **Buchungspunkten** an jeder Station und sichtbaren **Engpässen** (offene Tasks / Warteschlangen) in Camunda Cockpit.

- **Stack:** Camunda Platform **7** Community (Platform Run) – Cockpit, Tasklist, Admin, Welcome, REST  
- **Lizenz:** Open Source (Camunda Community)  
- **Cloud:** nicht nötig – alles lokal per Docker Compose  
- **Sprache:** deutsche Prozess-Labels  

---

## Voraussetzungen

- Docker + Docker Compose (Docker Desktop unter macOS/Windows oder Engine unter Linux)
- Optional: [Camunda Modeler](https://camunda.com/download/modeler/) oder [bpmn.io](https://demo.bpmn.io/) zum Bearbeiten der Modelle

> **Hinweis Agenten-Box:** Auf der Entwicklungsbox ohne Docker wurden die Dateien vollständig bereitgestellt. Auf dem Rechner von Belkis: `./scripts/start.sh` bzw. `docker compose up -d`.

---

## Schnellstart

```bash
cd logistik-camunda
./scripts/start.sh
# oder:
docker compose up -d
```

Warten bis Camunda bereit ist (~30–90 Sekunden), dann:

| Oberfläche | URL |
|---|---|
| **Welcome** | http://localhost:8080/ |
| **Cockpit** | http://localhost:8080/camunda/app/cockpit/ |
| **Tasklist** | http://localhost:8080/camunda/app/tasklist/ |
| **Admin** | http://localhost:8080/camunda/app/admin/ |
| **REST API** | http://localhost:8080/engine-rest/ |

### Zugangsdaten (nur Demo!)

| Benutzer | Passwort |
|---|---|
| `demo` | `demo` |

**In Produktion ändern** (siehe `config/default.yml` → `camunda.bpm.admin-user`).

Stoppen:

```bash
docker compose down
```

---

## Prozessmodelle

| Datei | Prozess-ID | Beschreibung |
|---|---|---|
| `processes/logistik-auftrag.bpmn` | `LogistikAuftrag` | Happy Path: Bestellung → Material-Buchung → Vormontage → Produktion → QS → Versand → Abgeschlossen; XOR Fehlteile / Engpass Vormontage / QS |
| `processes/station-buchung.bpmn` | `StationBuchung` | Kapazitäts-Buchung: „Buchung möglich“ vs. „Buchung nötig“ + Message-Event `KapazitaetFrei` |

BPMN-Dateien unter `./processes` werden per Volume gemountet. Zusätzlich manuell deployen:

```bash
./scripts/deploy-process.sh
# oder einzelne Datei:
./scripts/deploy-process.sh processes/logistik-auftrag.bpmn
```

### Modelle bearbeiten

1. **Camunda Modeler** (Desktop): https://camunda.com/download/modeler/  
2. **bpmn.io** (Browser): https://demo.bpmn.io/ – Datei öffnen, speichern, erneut deployen  

---

## Happy Path (Kurz)

1. **Bestellung eingegangen** (Start)  
2. **Material-/Lager-Buchung** (User Task)  
3. Gateway **Fehlteile?** → ggf. **Nachbestellung-Buchung**  
4. **Vormontage** (User Task)  
5. Gateway **Engpass Vormontage?** → *warten* / *umleiten* / Kapazität OK  
6. **Produktion / Montage**  
7. **QS / Freigabe** → ggf. Nacharbeit  
8. **Versand-Buchung**  
9. **Abgeschlossen**  

Variablen (Gateway-Bedingungen):

| Variable | Typ | Wirkung |
|---|---|---|
| `fehlteile` | Boolean | `true` → Nachbestellung-Buchung |
| `engpassEntscheidung` | String | `warten` / `umleiten` (sonst Kapazität OK) |
| `qsBestanden` | Boolean | `false` → Nacharbeit |
| `buchungMoeglich` | Boolean | nur `StationBuchung` |

---

## Demo in 5–8 Klicks (Kunde)

1. Browser → http://localhost:8080/ → **Cockpit** → Login `demo` / `demo`  
2. **Processes** → `Logistik-Auftrag (Ende-zu-Ende)` → Prozesskarte zeigen  
3. Terminal: `./scripts/demo-instances.sh 8` (startet 8 Aufträge)  
4. Zurück Cockpit → Prozess öffnen → **viele Token** auf erster Station (Material-Buchung)  
5. **Tasklist** → alle „Material-/Lager-Buchung“ abschließen (Complete)  
6. Cockpit neu laden → **Stau an Vormontage** = Engpass sichtbar  
7. Optional: eine Instanz mit `engpassEntscheidung=warten` starten und Warteschlangen-Pfad zeigen  
8. Happy Path einer Instanz bis **Abgeschlossen** durchklicken  

Ausführliche Storyline: [DEMO-RUNBOOK.md](./DEMO-RUNBOOK.md)

---

## Engpass in Cockpit zeigen

1. Cockpit → **Processes** → `LogistikAuftrag`  
2. Diagramm: Zahlen an Aktivitäten = **laufende Activity Instances**  
3. Viele offene Tasks an **Vormontage** = visueller Bottleneck  
4. Tab **Incidents** / **Job Log** bei Bedarf; für diese Demo reichen Activity-Zähler + Tasklist-Filter  

---

## Ports

| Port | Dienst |
|---|---|
| **8080** | Camunda Webapps + REST |

---

## Projektstruktur

```
logistik-camunda/
├── docker-compose.yml
├── config/default.yml
├── processes/
│   ├── logistik-auftrag.bpmn
│   └── station-buchung.bpmn
├── scripts/
│   ├── start.sh
│   ├── deploy-process.sh
│   └── demo-instances.sh
├── web/                      # Browser-Demo (Vite + bpmn-js)
│   ├── public/
│   └── src/
├── .github/workflows/pages.yml
├── README.md
└── DEMO-RUNBOOK.md
```

---


## Browser-Demo (GitHub Pages)

Statische Website unter `web/` (Vite + bpmn-js Viewer):

1. Öffnen: **https://beko2210.github.io/logistik-camunda/**
2. **Demo starten** → Token fließen durch den Prozess
3. Rechte Seite: Auslastung / Warteschlange je Station
4. Überlastete Stationen (z. B. Vormontage) werden **amber/rot** hervorgehoben

Lokal entwickeln:

```bash
cd web
npm install
npm run dev
```

Build: `npm run build` (Ausgabe `web/dist`, Base-Path `/logistik-camunda/`). Deployment erfolgt automatisch per GitHub Actions auf GitHub Pages.

---
## Hinweise

- Community Edition, H2-Datenbank im Container-Volume (Demo-only).  
- Repo: https://github.com/BEKO2210/logistik-camunda — Live-Demo via GitHub Pages.  
- Image: `camunda/camunda-bpm-platform:run-7.22.0` (offen, ohne Cloud-Account).  
