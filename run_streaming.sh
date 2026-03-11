#!/usr/bin/env bash
# Run Kit application with streaming enabled for local web development
#
# Usage:
#   ./run_streaming.sh
#   ./run_streaming.sh --/app/auto_load_usd=/path/to/scene.usd
#
# Environment variables:
#   USD_URL - Path to USD file to load (optional, has default)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

# Build if not already built
if [ ! -d "_build" ]; then
    echo "Building Kit application first..."

    # 1. Initialize the kit-cae submodule
    echo "Initializing kit-cae submodule..."
    git submodule update --init --recursive

    # 2. Build kit-cae schemas
    echo "Building kit-cae schemas..."
    ./deps/kit-cae/repo.sh schema

    # 3. Build kit-cae extensions
    echo "Building kit-cae extensions..."
    ./deps/kit-cae/repo.sh build

    # 4. Build kit-usd-agents extensions
    echo "Building kit-usd-agents extensions..."
    ./deps/kit-usd-agents/repo.sh build

    # 5. Precache extensions (must run after kit-cae is built)
    echo "Precaching extensions..."
    ./repo.sh build -u

    # 6. Build the DSX application
    echo "Building DSX application..."
    ./repo.sh build -r
fi

# Run the streaming version with no window
./repo.sh launch dsx_streaming.kit -- \
    --no-window \
    "$@"
