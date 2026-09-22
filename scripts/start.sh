#!/usr/bin/env bash
# Startet die Camunda-Logistik-Demo lokal (Docker Compose).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "FEHLER: Docker ist nicht installiert oder nicht im PATH."
  echo "Bitte Docker Desktop / Docker Engine installieren und erneut starten."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1 && ! docker-compose version >/dev/null 2>&1; then
  echo "FEHLER: docker compose ist nicht verfügbar."
  exit 1
fi

COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  COMPOSE="docker-compose"
fi

echo "==> Starte Camunda Platform 7 Community (Logistik-Demo)..."
$COMPOSE up -d

echo ""
echo "==> Warte auf Health (max. ~2 Min)..."
for i in $(seq 1 40); do
  if curl -sf "http://localhost:8080/engine-rest/engine" >/dev/null 2>&1; then
    echo "OK – Camunda ist bereit."
    break
  fi
  sleep 3
  if [[ $i -eq 40 ]]; then
    echo "WARNUNG: Timeout – Container läuft ggf. noch an. Logs: $COMPOSE logs -f camunda"
  fi
done

echo ""
echo "────────────────────────────────────────────"
echo "  Welcome:   http://localhost:8080/"
echo "  Cockpit:   http://localhost:8080/camunda/app/cockpit/"
echo "  Tasklist:  http://localhost:8080/camunda/app/tasklist/"
echo "  Admin:     http://localhost:8080/camunda/app/admin/"
echo "  REST:      http://localhost:8080/engine-rest/"
echo "  Login:     demo / demo   (nur Demo – in Prod ändern!)"
echo "────────────────────────────────────────────"
echo "Prozesse unter ./processes werden beim Start gemountet."
echo "Manuell deployen: ./scripts/deploy-process.sh"
