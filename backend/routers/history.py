from fastapi import APIRouter
from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from pathlib import Path
import json
import os


router = APIRouter(prefix="/history", tags=["History"])


IS_LAMBDA = bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
HISTORY_FILE = Path("/tmp/results/data/history_runs.jsonl") if IS_LAMBDA else Path("results/data/history_runs.jsonl")
HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)


class HistoryEntry(BaseModel):
    engine: str = Field(...)
    ticker: str | None = None
    market: str | None = None
    summary: dict = Field(default_factory=dict)
    timestamp: str = Field(...)


@router.post("/runs")
def add_run(entry: HistoryEntry):
    with HISTORY_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry.model_dump(), ensure_ascii=False) + "\n")
    return {"ok": True}


@router.get("/runs")
def get_runs(limit: int = 100):
    if not HISTORY_FILE.exists():
        return {"items": []}

    rows = []
    with HISTORY_FILE.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    rows = rows[-limit:]
    rows.reverse()
    return {"items": rows}


@router.delete("/runs")
def clear_runs(request: Request):
    client_host = request.client.host if request.client else ""
    localhost_hosts = {"127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"}
    if client_host not in localhost_hosts:
        raise HTTPException(status_code=403, detail="Clear history is restricted to local machine access.")

    if HISTORY_FILE.exists():
        HISTORY_FILE.unlink()
    return {"ok": True}
