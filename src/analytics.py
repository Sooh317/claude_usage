"""Multi-day aggregation logic for analytics."""

import json
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from . import aggregator

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_all_records(start_date: date, end_date: date) -> list[dict]:
    """Load all JSONL records for a date range."""
    all_records = []
    current = start_date
    while current <= end_date:
        records = aggregator.load_records(current)
        all_records.extend(records)
        current += timedelta(days=1)
    return all_records


def aggregate_range(start_date: date, end_date: date) -> dict[str, Any]:
    """Aggregate statistics for a date range.

    Returns:
        {
            "period_start": "YYYY-MM-DD",
            "period_end": "YYYY-MM-DD",
            "days_count": int,
            "days_with_data": int,
            "aggregate": {...},  # Aggregated metrics
            "daily": [...]       # Daily summaries for charts
        }
    """
    # Collect daily summaries
    daily_stats = []
    current = start_date
    while current <= end_date:
        summary = aggregator.aggregate(current)
        if summary:
            daily_stats.append(summary)
        current += timedelta(days=1)

    days_with_data = len(daily_stats)
    if days_with_data == 0:
        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "days_count": (end_date - start_date).days + 1,
            "days_with_data": 0,
            "aggregate": {},
            "daily": []
        }

    # Calculate aggregated metrics
    # Sum metrics
    total_sessions = sum(d.get("Sessions", 0) for d in daily_stats)
    total_api_calls = sum(d.get("API Calls", 0) for d in daily_stats)
    total_cost = sum(d.get("Total Cost ($)", 0) for d in daily_stats)
    total_input_tokens = sum(d.get("Input Tokens", 0) for d in daily_stats)
    total_output_tokens = sum(d.get("Output Tokens", 0) for d in daily_stats)
    total_cache_read = sum(d.get("Cache Read Tokens", 0) for d in daily_stats)
    total_cache_creation = sum(d.get("Cache Creation Tokens", 0) for d in daily_stats)
    total_tokens = sum(d.get("Total Tokens", 0) for d in daily_stats)
    total_lines_added = sum(d.get("Lines Added", 0) for d in daily_stats)
    total_lines_removed = sum(d.get("Lines Removed", 0) for d in daily_stats)
    total_commits = sum(d.get("Commits", 0) for d in daily_stats)
    total_prs = sum(d.get("Pull Requests", 0) for d in daily_stats)
    total_tool_calls = sum(d.get("Tool Calls", 0) for d in daily_stats)
    total_api_errors = sum(d.get("API Errors", 0) for d in daily_stats)
    total_user_prompts = sum(d.get("User Prompts", 0) for d in daily_stats)

    # Average metrics
    total_active_time = sum(d.get("Active Time (hrs)", 0) for d in daily_stats)
    avg_active_time_per_day = total_active_time / days_with_data

    # Weighted average for tool success rate
    total_tool_success_weighted = sum(
        d.get("Tool Success Rate (%)", 0) * d.get("Tool Calls", 0)
        for d in daily_stats
    )
    avg_tool_success_rate = (
        total_tool_success_weighted / total_tool_calls if total_tool_calls > 0 else 0
    )

    # Weighted average for API duration
    total_duration_weighted = sum(
        d.get("Avg API Duration (ms)", 0) * d.get("API Calls", 0)
        for d in daily_stats
    )
    avg_api_duration = (
        total_duration_weighted / total_api_calls if total_api_calls > 0 else 0
    )

    # Merge top tools across all days
    all_tools_counter: Counter[str] = Counter()
    for d in daily_stats:
        top_tools_str = d.get("Top Tools", "")
        if top_tools_str:
            tools = [t.strip() for t in top_tools_str.split(",")]
            for tool in tools:
                if tool:
                    all_tools_counter[tool] += 1
    top_tools = ", ".join(name for name, _ in all_tools_counter.most_common(3))

    # Merge model breakdown
    all_model_costs: dict[str, float] = {}
    for d in daily_stats:
        model_breakdown_str = d.get("Model Breakdown", "")
        if model_breakdown_str:
            # Parse "model1: $X, model2: $Y"
            for part in model_breakdown_str.split(","):
                part = part.strip()
                if ": $" in part:
                    model, cost_str = part.split(": $")
                    model = model.strip()
                    try:
                        cost = float(cost_str)
                        all_model_costs[model] = all_model_costs.get(model, 0) + cost
                    except ValueError:
                        pass

    model_breakdown = ", ".join(
        f"{m}: ${c:.2f}" for m, c in sorted(all_model_costs.items())
    )

    # Build aggregated result
    aggregate = {
        "Date": f"{start_date.isoformat()} to {end_date.isoformat()}",
        "Sessions": int(total_sessions),
        "Active Time (hrs)": round(total_active_time, 2),
        "Avg Active Time/day (hrs)": round(avg_active_time_per_day, 2),
        "User Prompts": int(total_user_prompts),
        "API Calls": int(total_api_calls),
        "Total Cost ($)": round(total_cost, 4),
        "Input Tokens": int(total_input_tokens),
        "Output Tokens": int(total_output_tokens),
        "Cache Read Tokens": int(total_cache_read),
        "Cache Creation Tokens": int(total_cache_creation),
        "Total Tokens": int(total_tokens),
        "Lines Added": int(total_lines_added),
        "Lines Removed": int(total_lines_removed),
        "Commits": int(total_commits),
        "Pull Requests": int(total_prs),
        "Tool Calls": int(total_tool_calls),
        "Tool Success Rate (%)": round(avg_tool_success_rate, 1),
        "Top Tools": top_tools,
        "API Errors": int(total_api_errors),
        "Avg API Duration (ms)": round(avg_api_duration, 1),
        "Model Breakdown": model_breakdown,
    }

    return {
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "days_count": (end_date - start_date).days + 1,
        "days_with_data": days_with_data,
        "aggregate": aggregate,
        "daily": daily_stats,
    }


def aggregate_week(start_date: date) -> dict[str, Any]:
    """Aggregate statistics for a 7-day week starting from start_date."""
    end_date = start_date + timedelta(days=6)
    result = aggregate_range(start_date, end_date)
    result["period_type"] = "week"
    return result


def aggregate_month(year: int, month: int) -> dict[str, Any]:
    """Aggregate statistics for a specific month."""
    import calendar

    start_date = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end_date = date(year, month, last_day)

    result = aggregate_range(start_date, end_date)
    result["period_type"] = "month"
    result["month"] = f"{year}-{month:02d}"
    return result


def _bucket_by_hour(records: list[dict]) -> dict[int, list[dict]]:
    """Group records by hour (0-23) based on timestamp."""
    buckets: dict[int, list[dict]] = {hour: [] for hour in range(24)}

    for record in records:
        ts_str = record.get("ts")
        if not ts_str:
            continue

        try:
            # Parse ISO 8601 timestamp
            ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            hour = ts.hour
            buckets[hour].append(record)
        except (ValueError, AttributeError):
            continue

    return buckets


def aggregate_hourly(target_date: date, granularity: str = "1h") -> dict[str, Any]:
    """Aggregate statistics by hour for a single day.

    Args:
        target_date: Date to aggregate
        granularity: Time bucket size (currently only "1h" supported)

    Returns:
        {
            "date": "YYYY-MM-DD",
            "granularity": "1h",
            "timezone": "UTC",
            "hourly": [
                {
                    "hour": 0,
                    "time_range": "00:00-01:00",
                    "api_calls": 10,
                    "input_tokens": 5000,
                    "output_tokens": 3000,
                    "cache_read_tokens": 1000,
                    "cache_creation_tokens": 500,
                    "total_tokens": 9500,
                    "total_cost": 0.0123,
                    "tool_calls": 5,
                    "avg_duration_ms": 1234.5
                },
                ...
            ]
        }
    """
    # Load all records for the target date
    records = aggregator.load_records(target_date)

    if not records:
        return {
            "date": target_date.isoformat(),
            "granularity": granularity,
            "timezone": "UTC",
            "hourly": []
        }

    # Group records by hour
    hourly_buckets = _bucket_by_hour(records)

    # Aggregate metrics for each hour
    hourly_stats = []

    for hour in range(24):
        hour_records = hourly_buckets[hour]

        # Count metrics
        api_calls = aggregator._event_count(hour_records, "api_request")
        tool_calls = aggregator._event_count(hour_records, "tool_result")

        # Token counts
        input_tokens = aggregator._sum_attr(hour_records, "api_request", "input_tokens")
        output_tokens = aggregator._sum_attr(hour_records, "api_request", "output_tokens")
        cache_read = aggregator._sum_attr(hour_records, "api_request", "cache_read_tokens")
        cache_creation = aggregator._sum_attr(hour_records, "api_request", "cache_creation_tokens")
        total_tokens = input_tokens + output_tokens + cache_read + cache_creation

        # Cost
        total_cost = aggregator._sum_attr(hour_records, "api_request", "cost_usd")

        # Average API duration
        avg_duration = aggregator._avg_attr(hour_records, "api_request", "duration_ms")

        hourly_stats.append({
            "hour": hour,
            "time_range": f"{hour:02d}:00-{(hour+1):02d}:00",
            "api_calls": int(api_calls),
            "input_tokens": int(input_tokens),
            "output_tokens": int(output_tokens),
            "cache_read_tokens": int(cache_read),
            "cache_creation_tokens": int(cache_creation),
            "total_tokens": int(total_tokens),
            "total_cost": round(total_cost, 4),
            "tool_calls": int(tool_calls),
            "avg_duration_ms": round(avg_duration, 1)
        })

    return {
        "date": target_date.isoformat(),
        "granularity": granularity,
        "timezone": "UTC",
        "hourly": hourly_stats
    }
