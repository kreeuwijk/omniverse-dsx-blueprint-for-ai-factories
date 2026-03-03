#!/usr/bin/env bash
# Run the web frontend for local development
#
# Usage:
#   ./run_web.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/web"

if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo ""
echo "Starting web development server..."
npm run dev
