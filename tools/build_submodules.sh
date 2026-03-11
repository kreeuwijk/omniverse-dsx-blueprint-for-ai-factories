#!/bin/bash
# Build submodule dependencies (kit-cae, kit-usd-agents) if not already built.
# Called by repo.toml before_pull_commands during `repo.sh build`.
# Usage: build_submodules.sh <repo-root>

set -e

ROOT="$1"
if [ -z "$ROOT" ]; then
    echo "[DSX] ERROR: build_submodules.sh requires repo root as first argument"
    exit 1
fi

# Ensure source/apps exists (required by repo_build)
mkdir -p "$ROOT/source/apps"

# ---- kit-cae ----
if [ -d "$ROOT/deps/kit-cae" ]; then
    if [ ! -d "$ROOT/deps/kit-cae/_build" ]; then
        echo "[DSX] Building kit-cae submodule (schema + extensions)..."
        cd "$ROOT/deps/kit-cae"
        find . -name "*.sh" -exec chmod +x {} + 2>/dev/null || true

        ./repo.sh schema || { echo "[DSX] ERROR: kit-cae schema step failed"; exit 1; }
        ./repo.sh build -r || { echo "[DSX] ERROR: kit-cae build failed"; exit 1; }

        echo "[DSX] kit-cae build complete."
    else
        echo "[DSX] kit-cae already built, skipping. Delete deps/kit-cae/_build to force rebuild."
    fi
fi

# ---- kit-usd-agents ----
if [ -d "$ROOT/deps/kit-usd-agents" ]; then
    if [ ! -d "$ROOT/deps/kit-usd-agents/_build/target-deps/pip_core_prebundle" ]; then
        echo "[DSX] Building kit-usd-agents submodule..."
        cd "$ROOT/deps/kit-usd-agents"
        find . -name "*.sh" -exec chmod +x {} + 2>/dev/null || true

        ./repo.sh build -r || { echo "[DSX] ERROR: kit-usd-agents build failed"; exit 1; }

        echo "[DSX] kit-usd-agents build complete."
    else
        echo "[DSX] kit-usd-agents already built, skipping. Delete deps/kit-usd-agents/_build to force rebuild."
    fi
fi

# ---- nvidia-nat-core + deps (needed by DSX agent, not included in kit-usd-agents prebundle) ----
NAT_PREBUNDLE="$ROOT/deps/kit-usd-agents/_build/target-deps/pip_nat_prebundle"
KIT_PYTHON="$ROOT/deps/kit-usd-agents/_build/target-deps/python/python"
if [ -d "$NAT_PREBUNDLE" ] && [ ! -d "$NAT_PREBUNDLE/nat/builder" ]; then
    echo "[DSX] Installing NAT packages into pip_nat_prebundle..."
    "$KIT_PYTHON" -m pip install \
        --no-deps --upgrade --target "$NAT_PREBUNDLE" nvidia-nat-core==1.6.0b1 PyJWT \
        || echo "[DSX] WARNING: nvidia-nat-core install failed, agent features may not work"
    echo "[DSX] nvidia-nat-core installed."
    # nvidia-nat-langchain shares the nat/ namespace — install to temp then copy plugin files
    TMP_LC="/tmp/nat_langchain_tmp"
    rm -rf "$TMP_LC"
    "$KIT_PYTHON" -m pip install --no-deps --target "$TMP_LC" nvidia-nat-langchain==1.4.1 \
        || echo "[DSX] WARNING: nvidia-nat-langchain install failed"
    if [ -d "$TMP_LC/nat/plugins/langchain" ]; then
        cp -r "$TMP_LC/nat/plugins/langchain" "$NAT_PREBUNDLE/nat/plugins/"
        echo "[DSX] nvidia-nat-langchain plugin copied."
    fi
    rm -rf "$TMP_LC"
    # Add backward-compat aliases for lc_agent_nat (AIQ* names were renamed in NAT 1.6)
    echo "" >> "$NAT_PREBUNDLE/nat/data_models/config.py"
    echo "AIQConfig = Config" >> "$NAT_PREBUNDLE/nat/data_models/config.py"
    echo "" >> "$NAT_PREBUNDLE/nat/data_models/api_server.py"
    echo "AIQChatRequest = ChatRequest" >> "$NAT_PREBUNDLE/nat/data_models/api_server.py"
    echo "AIQChatResponseChunk = ChatResponseChunk" >> "$NAT_PREBUNDLE/nat/data_models/api_server.py"
    echo "AIQChoice = ChatResponseChoice" >> "$NAT_PREBUNDLE/nat/data_models/api_server.py"
    echo "AIQChoiceMessage = ChoiceMessage" >> "$NAT_PREBUNDLE/nat/data_models/api_server.py"
    echo "[DSX] Added AIQ compat aliases."
fi

echo "[DSX] Submodule builds done."
