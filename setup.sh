#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$HOME"
LAUNCH_AGENTS="$HOME_DIR/Library/LaunchAgents"

echo "=== Claude Code Usage Tracker Setup ==="
echo "Project: $PROJECT_DIR"
echo ""

# 1. Create directories
echo "[1/5] Creating directories..."
mkdir -p "$PROJECT_DIR/data" "$PROJECT_DIR/logs" "$PROJECT_DIR/credentials"

# 2. Install dependencies
echo "[2/5] Installing dependencies with uv..."
if ! command -v uv &>/dev/null; then
    echo "ERROR: uv is not installed. Install it first: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi
UV_PATH="$(which uv)"
cd "$PROJECT_DIR" && uv sync

# 3. Create .env if not exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "[info] Created .env from .env.example — edit it with your Google Sheet ID"
fi

# 4. Install launchd plists
echo "[3/5] Installing launchd services..."
mkdir -p "$LAUNCH_AGENTS"

for plist in com.claude-usage.receiver.plist com.claude-usage.daily.plist; do
    label="${plist%.plist}"

    # Unload existing if loaded
    if launchctl list | grep -q "$label" 2>/dev/null; then
        launchctl unload "$LAUNCH_AGENTS/$plist" 2>/dev/null || true
    fi

    # Template substitution
    sed \
        -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
        -e "s|__HOME__|$HOME_DIR|g" \
        -e "s|__UV_PATH__|$UV_PATH|g" \
        "$PROJECT_DIR/config/$plist" > "$LAUNCH_AGENTS/$plist"

    launchctl load "$LAUNCH_AGENTS/$plist"
    echo "  Loaded $label"
done

# 5. Shell environment variables
echo "[4/5] Checking shell environment..."
ZSHRC="$HOME_DIR/.zshrc"
MARKER="# Claude Code Telemetry"

if [ -f "$ZSHRC" ] && grep -q "$MARKER" "$ZSHRC"; then
    echo "  Environment variables already in ~/.zshrc"
else
    echo "" >> "$ZSHRC"
    cat >> "$ZSHRC" << 'ENVBLOCK'

# Claude Code Telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
ENVBLOCK
    echo "  Added telemetry env vars to ~/.zshrc"
    echo "  Run: source ~/.zshrc (or restart terminal)"
fi

# Done
echo ""
echo "[5/5] Setup complete!"
echo ""
echo "--- Next steps ---"
echo "1. Verify receiver: curl http://localhost:4318/health"
echo "2. GCP setup (for Google Sheets):"
echo "   a. Create a GCP project & enable Google Sheets API"
echo "   b. Create a Service Account and download the JSON key"
echo "   c. Save it to: $PROJECT_DIR/credentials/service-account.json"
echo "   d. Share your Google Sheet with the service account email"
echo "   e. Edit .env and set GOOGLE_SHEET_ID"
echo "3. Test aggregator: uv run python -m src.aggregator --dry-run"
echo "4. Start a new Claude Code session to generate telemetry"
