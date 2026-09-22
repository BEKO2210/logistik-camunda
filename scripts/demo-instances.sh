#!/usr/bin/env bash
# Startet mehrere Prozessinstanzen für die Engpass-Demo (Vormontage-Stau).
set -euo pipefail
BASE_URL="${CAMUNDA_URL:-http://localhost:8080/engine-rest}"
USER="${CAMUNDA_USER:-demo}"
PASS="${CAMUNDA_PASS:-demo}"
COUNT="${1:-8}"
KEY="${2:-LogistikAuftrag}"

echo "==> Starte $COUNT Instanzen von Prozess '$KEY'..."
for i in $(seq 1 "$COUNT"); do
  businessKey="DEMO-$(date +%Y%m%d)-$(printf '%03d' "$i")"
  # Happy path Defaults: keine Fehlteile, Kapazität OK (Stau entsteht durch offene User Tasks)
  payload=$(cat <<JSON
{
  "businessKey": "$businessKey",
  "variables": {
    "fehlteile": { "value": false, "type": "Boolean" },
    "engpassEntscheidung": { "value": "ok", "type": "String" },
    "qsBestanden": { "value": true, "type": "Boolean" },
    "auftragNr": { "value": "$businessKey", "type": "String" }
  }
}
JSON
)
  curl -sS -u "$USER:$PASS" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$BASE_URL/process-definition/key/$KEY/start" >/dev/null
  echo "  gestartet: $businessKey"
done

echo ""
echo "Fertig. In Tasklist (demo/demo) liegen jetzt offene Tasks – typisch viele bei"
echo "„Material-/Lager-Buchung“. Tasks dort abschließen → Stapel wandert zu „Vormontage“."
echo "In Cockpit: Prozessdiagramm → Activity Instance Statistics = Engpass-Visualisierung."
