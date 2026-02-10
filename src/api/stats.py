"""Statistics API endpoints."""

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .. import aggregator, analytics, utils

router = APIRouter()
log = logging.getLogger(__name__)


@router.get("/daily")
async def get_daily_stats(
    date_param: str | None = Query(None, alias="date", description="Date in YYYY-MM-DD format")
) -> dict[str, Any]:
    """Get statistics for a single day.

    Args:
        date_param: Target date (YYYY-MM-DD). Defaults to today.

    Returns:
        Daily statistics dictionary with 21 metrics
    """
    try:
        if date_param is None:
            target_date = date.today()
        else:
            target_date = date.fromisoformat(date_param)

        log.info("Fetching daily stats for %s", target_date)
        summary = aggregator.aggregate(target_date)

        if not summary:
            raise HTTPException(
                status_code=404,
                detail=f"No data available for {target_date.isoformat()}"
            )

        return summary

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        log.exception("Error fetching daily stats")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weekly")
async def get_weekly_stats(
    start_date: str = Query(..., description="Week start date (YYYY-MM-DD, typically Monday)")
) -> dict[str, Any]:
    """Get statistics for a 7-day week.

    Args:
        start_date: Week start date (YYYY-MM-DD)

    Returns:
        {
            "period_start": "...",
            "period_end": "...",
            "days_count": 7,
            "days_with_data": N,
            "aggregate": {...},  # Aggregated metrics
            "daily": [...]       # Daily summaries
        }
    """
    try:
        start = date.fromisoformat(start_date)
        log.info("Fetching weekly stats starting %s", start)

        result = analytics.aggregate_week(start)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        log.exception("Error fetching weekly stats")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/monthly")
async def get_monthly_stats(
    month: str = Query(..., description="Month in YYYY-MM format")
) -> dict[str, Any]:
    """Get statistics for a calendar month.

    Args:
        month: Month in YYYY-MM format

    Returns:
        {
            "period_start": "...",
            "period_end": "...",
            "days_count": 28-31,
            "days_with_data": N,
            "month": "YYYY-MM",
            "aggregate": {...},
            "daily": [...]
        }
    """
    try:
        parts = month.split("-")
        if len(parts) != 2:
            raise ValueError(f"Expected YYYY-MM format, got: {month}")

        year = int(parts[0])
        month_num = int(parts[1])

        if not (1 <= month_num <= 12):
            raise ValueError(f"Month must be 1-12, got: {month_num}")

        log.info("Fetching monthly stats for %04d-%02d", year, month_num)
        result = analytics.aggregate_month(year, month_num)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid month format: {e}")
    except Exception as e:
        log.exception("Error fetching monthly stats")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/range")
async def get_range_stats(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    max_days: int = Query(90, description="Maximum allowed range in days")
) -> dict[str, Any]:
    """Get statistics for a custom date range.

    Args:
        start_date: Range start (YYYY-MM-DD)
        end_date: Range end (YYYY-MM-DD)
        max_days: Maximum allowed range (default 90)

    Returns:
        Aggregated statistics for the date range
    """
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)

        utils.validate_date_range(start, end, max_days)

        log.info("Fetching range stats from %s to %s", start, end)
        result = analytics.aggregate_range(start, end)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("Error fetching range stats")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available-dates")
async def get_available_dates() -> dict[str, Any]:
    """Get list of dates with available data.

    Returns:
        {
            "dates": ["YYYY-MM-DD", ...],
            "earliest": "YYYY-MM-DD",
            "latest": "YYYY-MM-DD",
            "count": N
        }
    """
    try:
        dates = utils.get_available_dates()

        return {
            "dates": dates,
            "earliest": dates[0] if dates else None,
            "latest": dates[-1] if dates else None,
            "count": len(dates)
        }

    except Exception as e:
        log.exception("Error fetching available dates")
        raise HTTPException(status_code=500, detail=str(e))
