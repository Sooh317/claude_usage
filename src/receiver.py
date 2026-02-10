"""OTLP HTTP/JSON receiver for Claude Code telemetry."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            Path(__file__).resolve().parent.parent / "logs" / "receiver.log"
        ),
    ],
)
log = logging.getLogger(__name__)

app = FastAPI(title="Claude Usage OTLP Receiver")


def _jsonl_path() -> Path:
    return DATA_DIR / f"{datetime.now().strftime('%Y-%m-%d')}.jsonl"


def _append(records: list[dict]) -> None:
    if not records:
        return
    path = _jsonl_path()
    with path.open("a") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    log.info("Wrote %d records to %s", len(records), path.name)


def _ts(time_unix_nano: int | str | None) -> str:
    if not time_unix_nano:
        return datetime.now(timezone.utc).isoformat()
    nano = int(time_unix_nano)
    return datetime.fromtimestamp(nano / 1e9, tz=timezone.utc).isoformat()


def _attrs_to_dict(attrs: list[dict] | None) -> dict:
    if not attrs:
        return {}
    result = {}
    for attr in attrs:
        key = attr.get("key", "")
        value = attr.get("value", {})
        if "stringValue" in value:
            result[key] = value["stringValue"]
        elif "intValue" in value:
            result[key] = int(value["intValue"])
        elif "doubleValue" in value:
            result[key] = value["doubleValue"]
        elif "boolValue" in value:
            result[key] = value["boolValue"]
        elif "arrayValue" in value:
            result[key] = [
                v.get("stringValue", v) for v in value["arrayValue"].get("values", [])
            ]
        else:
            result[key] = value
    return result


def _parse_body(body: dict | None) -> str | dict | None:
    """Parse an OTLP log record body."""
    if not body:
        return None
    if "stringValue" in body:
        return body["stringValue"]
    if "kvlistValue" in body:
        pairs = body["kvlistValue"].get("values", [])
        return {p["key"]: _parse_body(p.get("value")) for p in pairs}
    if "arrayValue" in body:
        return [_parse_body(v) for v in body["arrayValue"].get("values", [])]
    if "intValue" in body:
        return int(body["intValue"])
    if "doubleValue" in body:
        return body["doubleValue"]
    if "boolValue" in body:
        return body["boolValue"]
    return body


@app.post("/v1/metrics")
async def receive_metrics(request: Request) -> JSONResponse:
    payload = await request.json()
    records = []

    for rm in payload.get("resourceMetrics", []):
        resource_attrs = _attrs_to_dict(
            rm.get("resource", {}).get("attributes")
        )
        for sm in rm.get("scopeMetrics", []):
            scope_name = sm.get("scope", {}).get("name", "")
            for metric in sm.get("metrics", []):
                name = metric.get("name", "")
                for key in ("sum", "gauge", "histogram"):
                    container = metric.get(key)
                    if not container:
                        continue
                    for dp in container.get("dataPoints", []):
                        value = (
                            dp.get("asInt")
                            or dp.get("asDouble")
                            or dp.get("value")
                        )
                        records.append(
                            {
                                "ts": _ts(dp.get("timeUnixNano")),
                                "type": "metric",
                                "event": name,
                                "data": {
                                    "value": value,
                                    "attributes": _attrs_to_dict(
                                        dp.get("attributes")
                                    ),
                                    "scope": scope_name,
                                    "resource": resource_attrs,
                                    "aggregation": key,
                                },
                            }
                        )

    _append(records)
    return JSONResponse(content={}, status_code=200)


@app.post("/v1/logs")
async def receive_logs(request: Request) -> JSONResponse:
    payload = await request.json()
    records = []

    for rl in payload.get("resourceLogs", []):
        resource_attrs = _attrs_to_dict(
            rl.get("resource", {}).get("attributes")
        )
        for sl in rl.get("scopeLogs", []):
            scope_name = sl.get("scope", {}).get("name", "")
            for lr in sl.get("logRecords", []):
                body = _parse_body(lr.get("body"))
                attrs = _attrs_to_dict(lr.get("attributes"))
                event_name = attrs.pop("event.name", "") or (
                    body if isinstance(body, str) else ""
                )
                records.append(
                    {
                        "ts": _ts(lr.get("timeUnixNano")),
                        "type": "log",
                        "event": event_name,
                        "data": {
                            "body": body,
                            "attributes": attrs,
                            "scope": scope_name,
                            "resource": resource_attrs,
                            "severityText": lr.get("severityText", ""),
                        },
                    }
                )

    _append(records)
    return JSONResponse(content={}, status_code=200)


@app.post("/v1/traces")
async def receive_traces(request: Request) -> JSONResponse:
    """Accept traces endpoint to prevent OTLP export errors. Data is discarded."""
    return JSONResponse(content={}, status_code=200)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "data_dir": str(DATA_DIR)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=4318)
