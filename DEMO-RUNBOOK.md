# Demo-Runbook – Logistik-Camunda (Kundenmeeting)

**Ziel:** In 10–15 Minuten zeigen, dass Aufträge von Bestellung bis Versand durchlaufen – und dass **Engpässe an Stationen (z. B. Vormontage)** in Camunda Cockpit sichtbar werden.

**Zielgruppe:** Entscheider Logistik / Fertigung / IT (Microsoft-/Enterprise-Umfeld).  
**Sprache:** Deutsch.  
**Zugang:** `demo` / `demo` · http://localhost:8080/

> **Browser Control Tower (ohne Docker):** https://beko2210.github.io/logistik-camunda/  
> **Executive-Pitch (10 Min, Deutsch):** [DEMO-PITCH.md](./DEMO-PITCH.md) — empfohlen für C-Level; dieses Runbook ergänzt optional Camunda Cockpit als Engine-Wahrheit.


---

## Vorbereitung (vor dem Meeting, 2 Min)

```bash
cd logistik-camunda
./scripts/start.sh
# Health prüfen:
curl -sf http://localhost:8080/engine-rest/engine && echo OK
```

Browser-Tabs vorbereiten:

1. Welcome / Cockpit  
2. Tasklist  
3. Optional: Terminal mit `./scripts/demo-instances.sh` bereit  

Sicherstellen, dass Prozesse deployed sind (Cockpit → Processes → `LogistikAuftrag` und `StationBuchung`).

---

## Storyline (ca. 12 Minuten)

### 1) Framing (1 Min)

> „Wir visualisieren Ihren Auftrag von der Bestellung bis zum Versand. An jeder Station gibt es einen **Buchungspunkt**. Wenn zu viele Aufträge an einer Station warten, sehen Sie den **Engpass** sofort – ohne Excel-Stau.“

### 2) Prozesskarte (2 Min) – Cockpit

1. Cockpit → **Processes** → **Logistik-Auftrag (Ende-zu-Ende)**  
2. Diagramm zeigen, Stationen nennen:  
   - Material-/Lager-Buchung  
   - Vormontage (+ Engpass-Gateway)  
   - Produktion / Montage  
   - QS / Freigabe  
   - Versand-Buchung  
3. Kurz auf XOR **Fehlteile** und **Engpass Vormontage** (warten vs. umleiten) hinweisen  

**Key Message:** „Das ist kein Blackbox-Workflow – das ist Ihre Shopfloor-/Logistik-Logik als BPMN.“

### 3) Last erzeugen (1 Min)

Im Terminal:

```bash
./scripts/demo-instances.sh 8
```

Oder in Cockpit: Process Definition → **Start Process Application** / Start (8×) – REST-Skript ist schneller und konsistenter.

### 4) Erster Stau (2 Min) – Cockpit + Tasklist

1. Cockpit: Prozessdiagramm neu laden → **viele Instanzen** auf **Material-/Lager-Buchung**  
2. Tasklist: Filter „All tasks“ → Liste der offenen Buchungen  
3. Aussage: „Das ist schon ein Queue-Signal – Kapazität Lager/Buchung.“  

Dann 6–8× **Complete** auf Material-Buchung (Variablen leer lassen = Happy Path: keine Fehlteile).

### 5) Engpass Vormontage (3 Min) – der Wow-Moment

1. Cockpit Diagramm: Token/Zähler wandern auf **Vormontage**  
2. Zeigen: „Hier stapeln sich offene Tasks – **Bottleneck Vormontage**.“  
3. Optional eine neue Instanz mit Variable:  
   - `engpassEntscheidung` = `warten` → Pfad **Warten auf Kapazität**  
   - oder `umleiten` → **Umleitung alternative Station**  
4. Tasklist: Gruppe `vormontage` / Assignee `demo`  

**Key Message:** „Sie sehen nicht nur den Prozess – Sie sehen, *wo* er stockt. Darauf lassen sich Kapazität, Schichten und Buchungsregeln aufsetzen.“

### 6) Happy Path zu Ende (2 Min)

Eine Instanz komplett durchziehen:

1. Vormontage → Complete (`engpassEntscheidung` leer / nicht `warten`/`umleiten`)  
2. Produktion / Montage → Complete  
3. QS / Freigabe → Complete (`qsBestanden` true oder leer)  
4. Versand-Buchung → Complete  
5. Cockpit: Instanz **completed** / History  

### 7) Optional: Station-Buchung (1–2 Min)

Prozess **Station-Buchung (Kapazität)**:

- Start → Kapazität prüfen  
- Gateway: **Buchung möglich** vs. **Buchung nötig (warten)**  
- Message-Event `KapazitaetFrei` (per REST korrelieren, wenn Zeit):  

```bash
curl -u demo:demo -H "Content-Type: application/json" \
  -d '{"messageName":"KapazitaetFrei","all":true}' \
  http://localhost:8080/engine-rest/message
```

### 8) Abschluss / Next Steps (1 Min)

- Prozess ist Community / lokal / ohne Cloud-Zwang  
- Nächster Schritt: echte Buchungs-APIs (ERP/WMS), Rollen, KPI-Dashboard  
- Modelle mit Camunda Modeler oder bpmn.io pflegbar  

---

## Klick-Checkliste (5–8 Klicks)

| # | Aktion |
|---|---|
| 1 | http://localhost:8080/ öffnen |
| 2 | Cockpit → Login `demo`/`demo` |
| 3 | Processes → Logistik-Auftrag öffnen |
| 4 | `./scripts/demo-instances.sh 8` |
| 5 | Diagramm: Stau Material-Buchung zeigen |
| 6 | Tasklist: Material-Tasks completen |
| 7 | Cockpit: Stau Vormontage zeigen |
| 8 | Eine Instanz bis Versand/Ende durchklicken |

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Seite nicht erreichbar | `docker compose ps` / `docker compose logs -f camunda` |
| Keine Prozesse | `./scripts/deploy-process.sh` |
| Keine Tasks | Instanzen gestartet? Login `demo`? |
| Gateway geht „falsch“ | Variablen beim Complete setzen (`fehlteile`, `engpassEntscheidung`, `qsBestanden`) |
| Message bleibt hängen | `KapazitaetFrei` per REST korrelieren (siehe oben) |

---

## Sicherheitshinweis für den Kunden

Demo-User `demo`/`demo` und H2 in Docker sind **nur für lokale Präsentationen**. Für Staging/Prod: starke Passwörter, externe DB, Auth/SSO, Netzwerk-Absicherung.
