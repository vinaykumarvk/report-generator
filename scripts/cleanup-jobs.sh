#!/bin/bash

# Cleanup jobs script wrapper
# Usage: ./scripts/cleanup-jobs.sh [--all] [--status=QUEUED]

cd "$(dirname "$0")/.." || exit 1

echo "🧹 Job Cleanup Utility"
echo "======================"
echo ""

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js to use this script"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Please create .env with Supabase credentials"
    exit 1
fi

# Run the Node.js script
node scripts/cleanup-jobs.js "$@"




