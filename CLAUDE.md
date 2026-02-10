# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code usage tracker that captures OpenTelemetry telemetry from Claude Code CLI, stores it as JSONL files, and aggregates daily statistics to Google Sheets. Runs as background services on macOS using launchd.

## Development Setup

**Package Manager**: `uv` (not pip/poetry)

```bash
# Install dependencies
uv sync

# Run receiver manually (for testing)
uv run uvicorn src.receiver:app --host 127.0.0.1 --port 4318

# Run aggregator (dry-run to see output without uploading)
uv run python -m src.aggregator --dry-run

# Run aggregator for specific date
uv run python -m src.aggregator --date 2024-03-15

# Upload to Google Sheets
uv run python -m src.aggregator
```

## Architecture

**Data Flow**:
```
Claude Code (OTLP env vars)
  ↓ OTLP HTTP/JSON (localhost:4318)
FastAPI Receiver (launchd daemon)
  ↓ Writes to JSONL
data/YYYY-MM-DD.jsonl
  ↓ Daily at 23:59 (launchd)
Aggregator → Google Sheets API
  ↓
Google Spreadsheet (1 row per day)
```

**Key Components**:

1. **src/receiver.py** - FastAPI app that receives OTLP metrics/logs via HTTP/JSON and writes to daily JSONL files
   - Endpoints: `/v1/metrics`, `/v1/logs`, `/v1/traces` (discards), `/health`
   - Data normalized to: `{ts, type, event, data}`
   - Runs continuously on port 4318 via launchd

2. **src/aggregator.py** - Daily aggregation script that processes JSONL and computes 21 statistics
   - Token counts (input/output/cache_read/cache_creation)
   - Tool usage (calls, success rate, top 3 tools)
   - Model breakdown (cost per model)
   - Code activity (lines added/removed, commits, PRs)
   - Performance metrics (API errors, avg duration)

3. **src/sheets.py** - Google Sheets integration
   - Uses service account authentication
   - Prevents duplicate date entries
   - Auto-formats headers (bold, freeze row, currency/percentage formats)

**Data Storage**:
- `data/YYYY-MM-DD.jsonl` - Daily telemetry records (gitignored)
- `logs/` - Service logs (gitignored)
- `credentials/service-account.json` - GCP service account key (gitignored)

## Service Management

```bash
# Check service status
launchctl list | grep claude-usage

# Restart receiver
launchctl unload ~/Library/LaunchAgents/com.claude-usage.receiver.plist
launchctl load ~/Library/LaunchAgents/com.claude-usage.receiver.plist

# View logs
tail -f logs/receiver.stdout.log
tail -f logs/aggregator.log
```

## Important Notes

**Telemetry Environment Variables**: Required for Claude Code to send telemetry (added to ~/.zshrc by setup.sh):
```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

**OTLP Data Format**: The receiver parses OTLP HTTP/JSON format. Key transformations:
- Attributes are flattened from `{key: "foo", value: {stringValue: "bar"}}` to `{"foo": "bar"}`
- Log bodies can be strings, kvlists, or arrays - see `_parse_body()` in receiver.py
- Metrics support sum/gauge/histogram aggregations

**Google Sheets**:
- Sheet ID configured in `.env` as `GOOGLE_SHEET_ID`
- Credentials in `credentials/service-account.json`
- Service account must have editor access to the spreadsheet
- Headers are defined in `sheets.HEADERS` - changes require manual sheet cleanup

**Date Handling**: Aggregator defaults to today's date. Use `--date YYYY-MM-DD` to backfill historical data.

## Modifying Aggregated Metrics

To add/remove statistics tracked in Google Sheets:

1. Update `aggregator.aggregate()` to compute new metric from JSONL records
2. Add column to `sheets.HEADERS` list
3. Delete existing Google Sheet or manually add the new column header
4. Re-run aggregator for historical dates if backfilling needed

Helper functions for aggregation:
- `_metric_sum(records, name, attr_filter)` - Sum metric values
- `_event_count(records, event_name)` - Count log events
- `_sum_attr(records, event_name, attr_key)` - Sum attribute across events
- `_avg_attr(records, event_name, attr_key)` - Average attribute value
