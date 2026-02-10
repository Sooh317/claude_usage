"""Utility functions for analytics."""

import calendar
from datetime import date, timedelta
from pathlib import Path
from typing import Tuple

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def parse_date_range(period: str, date_param: str | None) -> Tuple[date, date]:
    """Parse period and date parameter into start_date and end_date.

    Args:
        period: "daily", "weekly", "monthly", or "custom"
        date_param: Date string in appropriate format

    Returns:
        (start_date, end_date) tuple

    Raises:
        ValueError: If date format is invalid
    """
    if period == "daily":
        if not date_param:
            target_date = date.today()
        else:
            target_date = date.fromisoformat(date_param)
        return target_date, target_date

    elif period == "weekly":
        if not date_param:
            # Default to current week (Monday start)
            today = date.today()
            start_date = today - timedelta(days=today.weekday())
        else:
            start_date = date.fromisoformat(date_param)
        end_date = start_date + timedelta(days=6)
        return start_date, end_date

    elif period == "monthly":
        if not date_param:
            # Default to current month
            today = date.today()
            year, month = today.year, today.month
        else:
            # Expected format: "YYYY-MM"
            parts = date_param.split("-")
            if len(parts) != 2:
                raise ValueError(f"Invalid month format: {date_param}. Expected YYYY-MM")
            year, month = int(parts[0]), int(parts[1])

        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)
        return start_date, end_date

    else:
        raise ValueError(f"Unknown period: {period}")


def validate_date_range(start_date: date, end_date: date, max_days: int = 90) -> None:
    """Validate a date range.

    Args:
        start_date: Range start
        end_date: Range end
        max_days: Maximum allowed range in days

    Raises:
        ValueError: If range is invalid
    """
    if start_date > end_date:
        raise ValueError(f"start_date ({start_date}) must be <= end_date ({end_date})")

    days = (end_date - start_date).days + 1
    if days > max_days:
        raise ValueError(
            f"Date range too large: {days} days (max {max_days})"
        )


def get_available_dates() -> list[str]:
    """Get list of dates with available data files.

    Returns:
        Sorted list of date strings (YYYY-MM-DD)
    """
    if not DATA_DIR.exists():
        return []

    dates = []
    for jsonl_file in DATA_DIR.glob("*.jsonl"):
        # File format: YYYY-MM-DD.jsonl
        date_str = jsonl_file.stem
        try:
            # Validate it's a valid date
            date.fromisoformat(date_str)
            dates.append(date_str)
        except ValueError:
            # Skip invalid filenames
            continue

    return sorted(dates)


def get_week_start(target_date: date) -> date:
    """Get the Monday of the week containing target_date."""
    return target_date - timedelta(days=target_date.weekday())


def get_month_string(target_date: date) -> str:
    """Get YYYY-MM string for a date."""
    return target_date.strftime("%Y-%m")
