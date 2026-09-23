# DEMO-PITCH — 10 Minuten Executive Walkthrough

**Ziel:** C-Level / Enterprise-Entscheider in ~10 Minuten überzeugen, dass End-to-End-Logistik mit Buchungspunkten **Engpässe und €-Impact** sichtbar macht — und Kapazitätsentscheidungen datengetrieben werden.

**Live:** https://beko2210.github.io/logistik-camunda/  
**Optional Engine:** Camunda Cockpit lokal (`DEMO-RUNBOOK.md`) — „das ist die gleiche Prozesswahrheit in der Engine“.

**Nicht sagen:** „Spike“, „PoC-Spielerei“, Microsoft-Partnerschaft, erfundenen Kundenlogos.  
**Schon sagen:** Demo-Annahme bei €-Stau, Browser-Simulation vs. optionaler Engine.

---

## Vorbereitung (90 Sekunden)

1. Browser-Tab: Live-Demo öffnen (Laptop + Beamer / Share-Screen).  
2. Zweiten Tab optional: Cockpit `http://localhost:8080/` (falls Docker läuft).  
3. Seite einmal laden — BPMN sollte sichtbar sein.  
4. €/Auftrag/h auf **8.500** lassen (oder Kundennähe anpassen und als Annahme nennen).  
5. Optional **Prozess-Baukasten** vorbereiten: Template passend zum Kunden (KFZ/Montage, Wareneingang→QS, **Wareneingang → QS → Freigabe → Lagerzug**, Buchung-first) oder „Leer“ + 3–4 Schritte — Selling Point: *„Ihre Linie in 2 Minuten nachbauen.“* Dauer in **Sekunden**, Buchungen als Liste sichtbar.

---

## Minute 0–1 · Framing

> „Wir zeigen Ihren Auftrag End-to-End als BPMN — mit **Buchungspunkten** und einem **Prozess-Baukasten**: Ihre Stationen, Ihre Reihenfolge. Wenn Kapazität fehlt, sehen Sie den Engpass sofort — und eine **€-Kennzahl** für den Stau. Klar gekennzeichnet als Demo-Annahme.“

Klick: Titel „Operations Control Tower“ kurz stehen lassen — kein Hero-Blog, Control Tower.

---

## Minute 1–3 · Pitch-Modus (empfohlen)

Klick: **Pitch-Modus**

| Schritt | Was passiert | Was Sie sagen |
|---|---|---|
| **1 Bestellung** | Overlay erklärt Start | „Jeder Auftrag ist ein Token im End-to-End-Prozess — auditierbar, erweiterbar.“ |
| **2 Buchungspunkte** | Simulation **startet automatisch** | „An jeder Station Kapazität. Tokens fließen jetzt live.“ |
| **3 Engpass sichtbar** | Vormontage wird amber/rot | „Vormontage ist bewusst eng dimensioniert — der Bottleneck ist auf der Karte und im Board sichtbar.“ |
| **4 €-Impact** | Peak-Last + €-Stau steigt | „Wartende Aufträge × €/Auftrag/Stunde = €-Stau. Das ist die Management-Zahl — nicht nur ein Diagramm.“ |
| **5 Entscheidung** | Kapazität+ | „Kapazität anheben oder priorisieren: WIP und €-Stau sinken. Nächster Schritt: echte Engine + ERP/WMS.“ |

Auto-Advance ~8 s oder **Weiter**. Bei Bedarf **Pitch beenden** und manuell steuern.

---

## Minute 3–6 · Manuelle Steuerung (falls ohne Pitch-Modus)

1. **Start** — Tokens laufen.  
2. KPI-Strip zeigen: **Durchsatz**, **WIP**, **Ø Durchlaufzeit**, **Engpass**, **€-Stau**.  
3. Szenario **Peak-Last** — Spawn schneller, gleiche Kapazität → Vormontage staut.  
4. Stations-Board: Auslastung %, Warteschlange, **€-Anteil am Stau**.  
5. **+10 Aufträge** — Last-Schub für den Wow-Moment.  
6. Szenario **Kapazität+** — Vormontage-Kapazität steigt, Entlastung sichtbar.  
7. Optional **Fehlteile-Krise** — langsameres Material + längere Wartezeiten.

**Key Message:** „Sie entscheiden über Kapazität und Priorität auf Basis sichtbarer Queues und €-Impact — nicht auf Basis von Excel-Nachlauf.“

---

## Minute 6–8 · Optional: Camunda Cockpit („Engine-Wahrheit“)

Nur wenn Docker läuft und Zeit bleibt:

1. Cockpit → Processes → **Logistik-Auftrag**.  
2. `./scripts/demo-instances.sh 8` (oder vorbereitet).  
3. Token-Zähler an Stationen = gleiche Story wie im Browser.  
4. Tasklist: offene Buchungen abschließen → Stau wandert zur Vormontage.

> „Die Browser-Demo ist der Control Tower für den Pitch. Camunda ist die Engine, die dieselbe Prozesslogik produktiv ausführt — lokal, Community, ohne Cloud-Zwang.“

Details: [DEMO-RUNBOOK.md](./DEMO-RUNBOOK.md)

---

## Minute 7–8 · Prozess-Baukasten (Wow-Moment)

> „Kein One-Size-Prozess: Sie stecken Ihre Stationen als Bauschritte — Name, Typ, Kapazität, Dauer in Sekunden, Buchung ja/nein, optional QS-Skip. Diagramm und Simulation folgen sofort.“

1. Rechts **Prozess-Baukasten** zeigen.  
2. Template **Wareneingang → QS → Freigabe → Lagerzug** laden (zwei Einlagerungen mit gleichem Namen) → **Übernehmen**.  
3. Start: Tokens laufen; Panel **Buchungen** zeigt belegt/frei.  
4. Optional Export JSON: „Das ist Ihr Kundenprofil für den nächsten Termin.“

Dann weiter mit Close — oder Cockpit, wenn Zeit.

---

## Minute 8–10 · Close & Next Steps

1. Reset → Normalbetrieb → ein ruhiger Zustand.  
2. Zusammenfassung in drei Sätzen:
   - End-to-End mit Buchungspunkten  
   - Engpass und €-Stau in Echtzeit  
   - Szenarien für Peak, Krise, Kapazität  
3. Next Steps anbieten:
   - Anbindung ERP/WMS / echte Buchungs-APIs  
   - Rollen, SSO, Staging-DB  
   - KPI-Dashboard an bestehende BI  
   - Camunda 7 Community als Einstieg, Upgrade-Pfad offen halten  

**Ask:** „Welchen Engpass würden Sie zuerst mit echten Zahlen hinterlegen — Vormontage, Material oder Versand?“

---

## Klick-Checkliste (Kurz)

| # | Aktion |
|---|---|
| 1 | Live-URL öffnen |
| 2 | Pitch-Modus **oder** Start |
| 3 | Peak-Last → Engpass + €-Stau zeigen |
| 4 | +10 Aufträge (optional) |
| 5 | Kapazität+ → Entlastung |
| 6 | Baukasten: Schritt einfügen / Template → Übernehmen |
| 7 | Optional Cockpit |
| 8 | Close / Next Steps |

---

## Talking Points / Einwände

| Einwand | Antwort |
|---|---|
| „Nur eine Simulation“ | Ja — bewusst für den Pitch. Dieselbe BPMN läuft in Camunda Cockpit (Engine). |
| „€-Zahlen sind Fantasie“ | Explizit **Demo-Annahme** — Feld ist konfigurierbar; Kundensatz einsetzen. |
| „Brauchen wir Cloud?“ | Nein. Lokal Docker oder nur Browser-Demo. |
| „Microsoft?“ | Fluent-/Enterprise-UI-Qualität; **keine** Partnerschaftsbehauptung. |

---

## Sicherheitshinweis

Demo-User `demo`/`demo` und H2 nur für lokale Präsentationen. Staging/Prod: starke Auth, externe DB, Netzwerk-Absicherung.
