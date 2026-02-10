"""Google Sheets integration for daily usage summaries."""

import logging
import os
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

HEADERS = [
    "Date",
    "Sessions",
    "Active Time (hrs)",
    "User Prompts",
    "API Calls",
    "Total Cost ($)",
    "Input Tokens",
    "Output Tokens",
    "Cache Read Tokens",
    "Cache Creation Tokens",
    "Total Tokens",
    "Lines Added",
    "Lines Removed",
    "Commits",
    "Pull Requests",
    "Tool Calls",
    "Tool Success Rate (%)",
    "Top Tools",
    "API Errors",
    "Avg API Duration (ms)",
    "Model Breakdown",
]


def _get_client() -> gspread.Client:
    creds_path = os.environ.get(
        "GOOGLE_CREDENTIALS_PATH",
        str(Path(__file__).resolve().parent.parent / "credentials" / "service-account.json"),
    )
    creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    return gspread.authorize(creds)


def _get_sheet() -> gspread.Worksheet:
    sheet_id = os.environ["GOOGLE_SHEET_ID"]
    client = _get_client()
    spreadsheet = client.open_by_key(sheet_id)
    return spreadsheet.sheet1


def _ensure_headers(ws: gspread.Worksheet) -> None:
    """Create header row if the sheet is empty."""
    existing = ws.row_values(1)
    if existing == HEADERS:
        return

    if not existing or all(c == "" for c in existing):
        ws.update("A1", [HEADERS])
        _format_headers(ws)
        log.info("Created header row")


def _format_headers(ws: gspread.Worksheet) -> None:
    """Apply formatting: bold headers, freeze first row."""
    ws.format("A1:U1", {
        "textFormat": {"bold": True},
        "backgroundColor": {"red": 0.9, "green": 0.9, "blue": 0.9},
    })
    ws.freeze(rows=1)

    # Currency format for Total Cost column (F)
    ws.format("F2:F1000", {"numberFormat": {"type": "NUMBER", "pattern": "$#,##0.0000"}})

    # Percentage format for Tool Success Rate column (Q)
    ws.format("Q2:Q1000", {"numberFormat": {"type": "NUMBER", "pattern": "#,##0.0'%'"}})


def _check_duplicate(ws: gspread.Worksheet, target_date: str) -> bool:
    """Return True if the date already exists in the sheet."""
    dates = ws.col_values(1)
    return target_date in dates


def append_row(summary: dict) -> None:
    """Append a daily summary row to Google Sheets."""
    ws = _get_sheet()
    _ensure_headers(ws)

    target_date = summary.get("Date", "")
    if _check_duplicate(ws, target_date):
        log.warning("Date %s already exists in sheet, skipping", target_date)
        return

    row = [summary.get(h, "") for h in HEADERS]
    ws.append_row(row, value_input_option="USER_ENTERED")
    log.info("Appended row for %s", target_date)
