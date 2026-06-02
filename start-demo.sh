#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AeroLink — one-command local demo
#
# Usage:
#   chmod +x start-demo.sh && ./start-demo.sh
#
# First run builds Docker images (~5-10 min). Subsequent runs are fast.
# ─────────────────────────────────────────────────────────────────────────────

set -e

COMPOSE="docker compose -f docker-compose.full.yml"

echo "🚀 Starting AeroLink full stack..."
$COMPOSE up -d --build

echo ""
echo "⏳ Waiting for all services to be healthy..."
$COMPOSE wait demo-seed 2>/dev/null || true

echo ""
echo "🌐 Starting webui dev server..."
cd webui && npm install --silent && npm run dev &
WEBUI_PID=$!
cd ..

echo ""
echo "════════════════════════════════════════════════"
echo "  AeroLink is running!"
echo ""
echo "  Webui:         http://localhost:5173"
echo "  API Gateway:   http://localhost:8080/api/v1"
echo "  Kafka UI:      http://localhost:8090"
echo ""
echo "  Password for all demo users: Demo@2024"
echo "  admin@aerolink.app         → Admin dashboard"
echo "  passenger@aerolink.app     → Passenger flow"
echo "  gateagent@aerolink.app     → Gate Agent"
echo "  flightops@aerolink.app     → Flight Ops"
echo "  immigration@aerolink.app   → Immigration"
echo "════════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop the webui (services keep running in Docker)."
wait $WEBUI_PID
