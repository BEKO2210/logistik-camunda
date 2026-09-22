#!/usr/bin/env bash
# Deployt BPMN-Dateien per REST API nach Camunda.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${CAMUNDA_URL:-http://localhost:8080/engine-rest}"
USER="${CAMUNDA_USER:-demo}"
PASS="${CAMUNDA_PASS:-demo}"

FILES=("$@")
if [[ ${#FILES[@]} -eq 0 ]]; then
  FILES=("$ROOT/processes/"*.bpmn)
fi

if ! curl -sf "$BASE_URL/engine" >/dev/null 2>&1; then
  echo "FEHLER: Camunda REST nicht erreichbar unter $BASE_URL"
  echo "Zuerst starten: ./scripts/start.sh"
  exit 1
fi

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Überspringe (nicht gefunden): $f"
    continue
  fi
  name="$(basename "$f")"
  echo "==> Deploy: $name"
  curl -sS -u "$USER:$PASS" \
    -H "Accept: application/json" \
    -F "deployment-name=logistik-demo" \
    -F "enable-duplicate-filtering=true" \
    -F "deploy-changed-only=true" \
    -F "$name=@$f;type=text/xml" \
    "$BASE_URL/deployment/create" | head -c 400
  echo ""
done

echo ""
echo "Deployments: $BASE_URL/deployment"
echo "Prozessdefinitionen: $BASE_URL/process-definition"
