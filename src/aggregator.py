"""Daily aggregator: reads JSONL telemetry and produces a summary row."""

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

from dotenv import load_dotenv

from . import pricing, sheets

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            Path(__file__).resolve().parent.parent / "logs" / "aggregator.log"
        ),
    ],
)
log = logging.getLogger(__name__)


def load_records(target_date: date) -> list[dict]:
    path = DATA_DIR / f"{target_date.isoformat()}.jsonl"
    if not path.exists():
        log.warning("No data file for %s", target_date)
        return []
    records = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    log.info("Loaded %d records from %s", len(records), path.name)
    return records


def _metric_sum(records: list[dict], name: str, attr_filter: dict | None = None) -> float:
    """Sum all metric values matching name and optional attribute filter."""
    total = 0.0
    for r in records:
        if r["type"] != "metric" or r["event"] != name:
            continue
        if attr_filter:
            attrs = r["data"].get("attributes", {})
            if not all(attrs.get(k) == v for k, v in attr_filter.items()):
                continue
        val = r["data"].get("value")
        if val is not None:
            total += float(val)
    return total


def _event_count(records: list[dict], event_name: str) -> int:
    return sum(1 for r in records if r["type"] == "log" and r["event"] == event_name)


def _event_records(records: list[dict], event_name: str) -> list[dict]:
    return [r for r in records if r["type"] == "log" and r["event"] == event_name]


def _sum_attr(records: list[dict], event_name: str, attr_key: str) -> float:
    total = 0.0
    for r in _event_records(records, event_name):
        attrs = r["data"].get("attributes", {})
        body = r["data"].get("body", {})
        val = attrs.get(attr_key) or (body.get(attr_key) if isinstance(body, dict) else None)
        if val is not None:
            total += float(val)
    return total


def _avg_attr(records: list[dict], event_name: str, attr_key: str) -> float:
    values = []
    for r in _event_records(records, event_name):
        attrs = r["data"].get("attributes", {})
        body = r["data"].get("body", {})
        val = attrs.get(attr_key) or (body.get(attr_key) if isinstance(body, dict) else None)
        if val is not None:
            values.append(float(val))
    return sum(values) / len(values) if values else 0.0


def aggregate(target_date: date) -> dict:
    records = load_records(target_date)
    if not records:
        return {}

    # Token counts
    input_tokens = _sum_attr(records, "api_request", "input_tokens")
    output_tokens = _sum_attr(records, "api_request", "output_tokens")
    cache_read = _sum_attr(records, "api_request", "cache_read_tokens")
    cache_creation = _sum_attr(records, "api_request", "cache_creation_tokens")
    total_tokens = input_tokens + output_tokens + cache_read + cache_creation

    # Tool stats
    tool_events = _event_records(records, "tool_result")
    tool_counter: Counter[str] = Counter()
    tool_success = 0
    for r in tool_events:
        attrs = r["data"].get("attributes", {})
        body = r["data"].get("body", {})
        src = attrs if attrs else (body if isinstance(body, dict) else {})
        tool_name = src.get("tool_name", src.get("tool", "unknown"))
        tool_counter[tool_name] += 1
        if src.get("success", src.get("is_success", True)):
            tool_success += 1
    total_tool_calls = len(tool_events)
    tool_success_rate = (tool_success / total_tool_calls * 100) if total_tool_calls else 0.0
    top_tools = ", ".join(name for name, _ in tool_counter.most_common(3))

    # Per-model token breakdown and pricing-based cost
    model_details: dict[str, dict] = {}
    for r in _event_records(records, "api_request"):
        attrs = r["data"].get("attributes", {})
        body = r["data"].get("body", {})
        src = attrs if attrs else (body if isinstance(body, dict) else {})
        model = src.get("model", "unknown")
        if model not in model_details:
            model_details[model] = {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0,
                "cost": 0.0,
            }
        md = model_details[model]
        m_in = float(src.get("input_tokens", 0))
        m_out = float(src.get("output_tokens", 0))
        m_cr = float(src.get("cache_read_tokens", 0))
        m_cc = float(src.get("cache_creation_tokens", 0))
        md["input_tokens"] += int(m_in)
        md["output_tokens"] += int(m_out)
        md["cache_read_tokens"] += int(m_cr)
        md["cache_creation_tokens"] += int(m_cc)
        md["cost"] += pricing.calculate_cost(model, m_in, m_out, m_cr, m_cc)

    # Round costs
    for md in model_details.values():
        md["cost"] = round(md["cost"], 6)

    # Derive total cost and model breakdown string from pricing
    total_cost_priced = round(sum(md["cost"] for md in model_details.values()), 4)
    model_breakdown = ", ".join(
        f"{m}: ${md['cost']:.2f}" for m, md in sorted(model_details.items())
    )

    # Unique sessions
    session_ids = set()
    for r in records:
        res = r["data"].get("resource", {})
        sid = res.get("session.id") or res.get("service.instance.id")
        if sid:
            session_ids.add(sid)
    session_count = _metric_sum(records, "session.count")
    if session_count == 0:
        session_count = len(session_ids) or 1

    return {
        "Date": target_date.isoformat(),
        "Sessions": int(session_count),
        "Active Time (hrs)": round(_metric_sum(records, "active_time.total") / 3600, 2),
        "User Prompts": _event_count(records, "user_prompt"),
        "API Calls": _event_count(records, "api_request"),
        "Total Cost ($)": total_cost_priced,
        "Input Tokens": int(input_tokens),
        "Output Tokens": int(output_tokens),
        "Cache Read Tokens": int(cache_read),
        "Cache Creation Tokens": int(cache_creation),
        "Total Tokens": int(total_tokens),
        "Lines Added": int(_metric_sum(records, "lines_of_code.count", {"type": "added"})),
        "Lines Removed": int(_metric_sum(records, "lines_of_code.count", {"type": "removed"})),
        "Commits": int(_metric_sum(records, "commit.count")),
        "Pull Requests": int(_metric_sum(records, "pull_request.count")),
        "Tool Calls": total_tool_calls,
        "Tool Success Rate (%)": round(tool_success_rate, 1),
        "Top Tools": top_tools,
        "API Errors": _event_count(records, "api_error"),
        "Avg API Duration (ms)": round(_avg_attr(records, "api_request", "duration_ms"), 1),
        "Model Breakdown": model_breakdown,
        "model_details": model_details,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Aggregate daily Claude Code usage")
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Target date (YYYY-MM-DD). Defaults to today.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary without uploading to Sheets.",
    )
    args = parser.parse_args()

    target = date.fromisoformat(args.date) if args.date else date.today()
    log.info("Aggregating data for %s", target)

    summary = aggregate(target)
    if not summary:
        log.warning("No data to aggregate for %s", target)
        sys.exit(0)

    log.info("Summary: %s", json.dumps(summary, indent=2, ensure_ascii=False))

    if args.dry_run:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return

    try:
        sheets.append_row(summary)
        log.info("Uploaded to Google Sheets")
    except Exception:
        log.exception("Failed to upload to Google Sheets")
        sys.exit(1)


if __name__ == "__main__":
    main()
