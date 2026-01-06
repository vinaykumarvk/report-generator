#!/bin/bash

# Local Worker Start Script
# Automatically uses .env.local and handles port conflicts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Default port (use 18081 to avoid conflicts with 18080)
DEFAULT_PORT=${PORT:-18081}
WORKER_PORT=$DEFAULT_PORT

# Check if port is in use and find an available one
check_port() {
  local port=$1
  if lsof -ti:$port >/dev/null 2>&1; then
    return 1  # Port is in use
  fi
  return 0  # Port is free
}

# Find available port starting from DEFAULT_PORT
if ! check_port $WORKER_PORT; then
  echo "⚠️  Port $WORKER_PORT is in use, trying next available port..."
  for port in $(seq $DEFAULT_PORT $((DEFAULT_PORT + 10))); do
    if check_port $port; then
      WORKER_PORT=$port
      echo "✅ Found available port: $WORKER_PORT"
      break
    fi
  done
  
  if [ "$WORKER_PORT" = "$DEFAULT_PORT" ]; then
    echo "❌ Could not find available port in range $DEFAULT_PORT-$((DEFAULT_PORT + 10))"
    exit 1
  fi
fi

# Ensure .env.local exists
if [ ! -f ".env.local" ]; then
  echo "⚠️  .env.local not found, creating from .env.example if it exists..."
  if [ -f ".env.example" ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from .env.example"
    echo "⚠️  Please update .env.local with your credentials"
  else
    echo "❌ .env.local not found and no .env.example to copy from"
    exit 1
  fi
fi

# Set environment variables
export PORT=$WORKER_PORT
export DOTENV_CONFIG_PATH="$(pwd)/.env.local"
export SERVICE_MODE=worker

# Ensure JOB_TRIGGER_MODE is set (default to http for local dev)
if [ -z "$JOB_TRIGGER_MODE" ]; then
  export JOB_TRIGGER_MODE=http
fi

# Set WORKER_TRIGGER_URL if not set
if [ -z "$WORKER_TRIGGER_URL" ]; then
  export WORKER_TRIGGER_URL="http://localhost:$WORKER_PORT/process-job"
fi

# Set WORKER_TRIGGER_SECRET if not set (use a default for local dev)
if [ -z "$WORKER_TRIGGER_SECRET" ]; then
  export WORKER_TRIGGER_SECRET="local-dev-secret-$(date +%s)"
  echo "⚠️  WORKER_TRIGGER_SECRET not set, using: $WORKER_TRIGGER_SECRET"
fi

echo "🚀 Starting worker locally..."
echo "   Port: $WORKER_PORT"
echo "   Env file: $DOTENV_CONFIG_PATH"
echo "   Trigger mode: $JOB_TRIGGER_MODE"
echo "   Trigger URL: $WORKER_TRIGGER_URL"
echo ""

# Start the worker
node workers/worker-with-health.js

