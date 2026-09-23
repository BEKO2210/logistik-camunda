# Logistik Camunda — Operations Control Tower (Enterprise Demo)

> **Live Demo (Browser):** [https://beko2210.github.io/logistik-camunda/](https://beko2210.github.io/logistik-camunda/)  
> Interaktive BPMN-Prozesskarte mit **Prozess-Baukasten** (firmenspezifische Linien), Executive-KPIs, Szenario-Presets, Pitch-Modus und €-Stau — ohne Docker.  
> **Pitch-Skript (10 Min):** [DEMO-PITCH.md](./DEMO-PITCH.md)

Kundenfähige Demo für Logistik-/Fertigungsprozesse: **Buchungspunkte** an jeder Station, sichtbare **Engpässe** (Warteschlangen / Auslastung) und eine klar gekennzeichnete **€-Impact-Kennzahl** (Demo-Annahme). Geeignet für C-Level- / Enterprise-Pitches — optional ergänzt um Camunda Cockpit als „Engine-Wahrheit“.

| | |
|---|---|
| **Browser-Demo** | Vite + bpmn-js NavigatedViewer · GitHub Pages |
| **Engine (optional)** | Camunda Platform **7** Community (Platform Run) — lokal per Docker |
| **Lizenz** | Open Source (Camunda Community) |
| **Cloud** | nicht nötig |
| **Sprache** | Deutsch (UI + Pitch) |

---

## Was die Live-Demo zeigt

1. **Prozess-Baukasten** — Stationen manuell einfügen, umordnen, löschen; Typ/Kapazität/**Dauer in Sekunden**/Buchungspflicht/optional Skip-% (XOR); gleiche Stationsnamen erlaubt; Templates inkl. **Wareneingang → QS → Freigabe → Lagerzug**; Export/Import JSON; Persistenz in `localStorage`  
2. **Prozesskarte** — BPMN wird clientseitig aus der aktuellen Linie generiert (Start → UserTasks → optional XOR-Skip → Ende)  
3. **Executive KPI-Strip** — Durchsatz, WIP, Ø Durchlaufzeit, Engpass-Station, **€-Stau** (wartende Tokens × €/Auftrag/h — Demo-Annahme)  
4. **Szenarien** — Normalbetrieb · Peak-Last · Fehlteile-Krise · Kapazität+ (wirken auf die aktuelle Config)  
5. **Pitch-Modus** — 5-Schritt-Overlay für den Vertriebs-/Executive-Walkthrough  
6. **Stations-Board** — Kapazität, in Arbeit, Warteschlange, Auslastung %, €-Anteil am Stau  
7. **Buchungen** — lesbare Liste aktiver/freigegebener Stationsbuchungen (Station, Auftrag, Sim-Zeit, Status belegt/frei) + Badge „B“ auf der Karte  

---

## Schnellstart — Browser (empfohlen für Pitch)

Öffnen: **https://beko2210.github.io/logistik-camunda/**

Lokal:

```bash
cd web
npm install
npm run dev
```

Build: `npm run build` (Base-Path `/logistik-camunda/`, Ausgabe `web/dist`). Deploy via GitHub Actions → Pages.

Ausführliches Pitch-Skript: **[DEMO-PITCH.md](./DEMO-PITCH.md)** · Cockpit-Storyline: **[DEMO-RUNBOOK.md](./DEMO-RUNBOOK.md)**

---

## Prozess-Baukasten (firmenspezifisch)

Jede Firma hat eine andere Fließrichtung (Wareneneingang→QS zuerst, Buchung zuerst, Schritte überspringen). Im Live-Control-Tower:

1. Rechts **Prozess-Baukasten** öffnen (oder Toolbar-Button).  
2. Template wählen (z. B. **Wareneingang → QS → Freigabe → Lagerzug**) **oder** „Schritt einfügen“ (Typ + Name, Einfügen nach Auswahl).  
3. Mit ↑↓ umordnen, inline editieren (Name, Typ, Kapazität, **Dauer min–max in Sekunden**, Buchungspflicht, optional **Skip-%** für QS/optionale Schritte), löschen. Gleiche Namen (z. B. zwei „Einlagerung“) sind erlaubt — IDs bleiben eindeutig.  
4. **Übernehmen** → BPMN + Simulation werden neu aufgebaut (bei Skip-% erscheint ein XOR-Gateway).  
5. Simulation starten → Panel **Buchungen** zeigt belegt/frei mit Station, Auftrag und Sim-Zeit.  
6. **Export JSON / Import JSON** für Kundenprofile; aktivierte Config liegt unter `localStorage`-Key `logistik-process-config`.

So lässt sich im Meeting die Kundenlinie in ca. **2 Minuten** nachbauen — ohne fest verdrahteten One-Size-Prozess.

---

## Schnellstart — Camunda Docker (Engine / Cockpit)

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

> **Hinweis Agenten-Box:** Ohne Docker lokal: Browser-Demo unter `web/` bzw. Live-URL. Auf dem Rechner von Belkis: `./scripts/start.sh` für die Engine.

---

## Prozessmodelle

| Datei | Prozess-ID | Beschreibung |
|---|---|---|
| `processes/logistik-auftrag.bpmn` | `LogistikAuftrag` | Happy Path: Bestellung → Material-Buchung → Vormontage → Produktion → QS → Versand; XOR Fehlteile / Engpass Vormontage / QS |
| `processes/station-buchung.bpmn` | `StationBuchung` | Kapazitäts-Buchung: „Buchung möglich“ vs. „Buchung nötig“ + Message-Event `KapazitaetFrei` |

BPMN unter `./processes` per Volume gemountet. Manuell deployen:

```bash
./scripts/deploy-process.sh
# oder:
./scripts/deploy-process.sh processes/logistik-auftrag.bpmn
```

### Modelle bearbeiten

1. **Camunda Modeler** (Desktop): https://camunda.com/download/modeler/  
2. **bpmn.io** (Browser): https://demo.bpmn.io/

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

| Variable | Typ | Wirkung |
|---|---|---|
| `fehlteile` | Boolean | `true` → Nachbestellung-Buchung |
| `engpassEntscheidung` | String | `warten` / `umleiten` (sonst Kapazität OK) |
| `qsBestanden` | Boolean | `false` → Nacharbeit |
| `buchungMoeglich` | Boolean | nur `StationBuchung` |

---

## Demo in 5–8 Klicks (Engine)

1. Browser → http://localhost:8080/ → **Cockpit** → Login `demo` / `demo`  
2. **Processes** → `Logistik-Auftrag (Ende-zu-Ende)` → Prozesskarte zeigen  
3. Terminal: `./scripts/demo-instances.sh 8`  
4. Cockpit → viele Token auf Material-Buchung  
5. **Tasklist** → Material-Buchungen abschließen  
6. Cockpit → **Stau an Vormontage**  
7. Optional: Instanz mit `engpassEntscheidung=warten`  
8. Happy Path bis **Abgeschlossen**  

Details: [DEMO-RUNBOOK.md](./DEMO-RUNBOOK.md) · Executive-Pitch (Browser): [DEMO-PITCH.md](./DEMO-PITCH.md)

---

## Engpass in Cockpit zeigen

1. Cockpit → **Processes** → `LogistikAuftrag`  
2. Diagramm: Zahlen an Aktivitäten = laufende Activity Instances  
3. Viele offene Tasks an **Vormontage** = visueller Bottleneck  

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
├── web/                      # Operations Control Tower (Vite + bpmn-js)
│   ├── public/
│   └── src/
├── .github/workflows/pages.yml
├── README.md
├── DEMO-PITCH.md             # 10-Minuten Executive-Pitch (Browser)
└── DEMO-RUNBOOK.md           # Cockpit-/Engine-Storyline
```

---

## Hinweise

- Community Edition, H2-Datenbank im Container-Volume (Demo-only).  
- Repo: https://github.com/BEKO2210/logistik-camunda — Live-Demo via GitHub Pages.  
- Image: `camunda/camunda-bpm-platform:run-7.22.0` (offen, ohne Cloud-Account).  
- Keine erfundenen Kundenlogos, keine Partnerschaftsbehauptungen — Fokus auf Prozess, KPIs und Entscheidungsqualität.  
