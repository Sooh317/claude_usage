"""Export API endpoints."""

import csv
import io
import logging
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from .. import analytics, sheets

router = APIRouter()
log = logging.getLogger(__name__)


@router.get("/csv")
async def export_csv(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)")
):
    """Export statistics to CSV file.

    Args:
        start_date: Range start (YYYY-MM-DD)
        end_date: Range end (YYYY-MM-DD)

    Returns:
        CSV file download
    """
    try:
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)

        log.info("Exporting CSV from %s to %s", start, end)

        # Get aggregated data
        result = analytics.aggregate_range(start, end)
        daily_stats = result.get("daily", [])

        if not daily_stats:
            raise HTTPException(
                status_code=404,
                detail="No data available for the specified date range"
            )

        # Create CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=sheets.HEADERS)

        # Write header
        writer.writeheader()

        # Write rows
        for day_stat in daily_stats:
            writer.writerow(day_stat)

        # Get CSV content
        csv_content = output.getvalue()
        output.close()

        # Create filename
        filename = f"claude-usage-{start_date}-to-{end_date}.csv"

        # Return as streaming response
        return StreamingResponse(
            iter([csv_content]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        log.exception("Error exporting CSV")
        raise HTTPException(status_code=500, detail=str(e))
