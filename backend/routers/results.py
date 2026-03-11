from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Optional
import json
import mimetypes
import os

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


router = APIRouter(prefix="/results", tags=["Results"])

IS_LAMBDA = bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
RESULTS_ROOT = Path("/tmp/results") if IS_LAMBDA else Path("results")
SESSIONS_ROOT = RESULTS_ROOT / "sessions"
SESSIONS_ROOT.mkdir(parents=True, exist_ok=True)

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"}
TABLE_EXTS = {".csv", ".tsv", ".xlsx", ".xls", ".json"}


class ResultLogRequest(BaseModel):
    engine: str = Field(...)
    ticker: Optional[str] = None
    market: Optional[str] = None
    source: Optional[str] = None
    summary: dict = Field(default_factory=dict)
    payload: dict = Field(default_factory=dict)


def _safe_name(value: str, fallback: str = "item") -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in (value or "").strip())
    return cleaned[:80] if cleaned else fallback


def _session_name_now() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _resolve_target(session: str, relpath: str) -> Path:
    safe_session = _safe_name(session, fallback=_session_name_now())
    base = (SESSIONS_ROOT / safe_session).resolve()
    target = (base / relpath).resolve()

    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return target


def _flatten_dict(value: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, item in value.items():
        key_name = f"{prefix}{key}"
        if isinstance(item, dict):
            out.update(_flatten_dict(item, prefix=f"{key_name}."))
        elif isinstance(item, (list, tuple)):
            out[key_name] = json.dumps(item, ensure_ascii=False)
        else:
            out[key_name] = item
    return out


def _extract_table_from_payload(summary: dict[str, Any], payload: dict[str, Any]) -> pd.DataFrame:
    candidate_keys = ("table", "data", "rows", "results", "series")

    for source in (payload, summary):
        if not isinstance(source, dict):
            continue
        for key in candidate_keys:
            value = source.get(key)
            if isinstance(value, list) and value and all(isinstance(row, dict) for row in value):
                return pd.DataFrame(value)

    base_meta = {
        "engine": summary.get("engine") if isinstance(summary, dict) else None,
    }
    summary_flat = _flatten_dict(summary or {}, prefix="summary.")
    payload_flat = _flatten_dict(payload or {}, prefix="payload.")
    row = {**base_meta, **summary_flat, **payload_flat}
    return pd.DataFrame([row])


def _read_table_file(target: Path) -> pd.DataFrame:
    ext = target.suffix.lower()
    if ext == ".csv":
        return pd.read_csv(target)
    if ext == ".tsv":
        return pd.read_csv(target, sep="\t")
    if ext in {".xlsx", ".xls"}:
        return pd.read_excel(target)
    if ext == ".json":
        parsed = json.loads(target.read_text(encoding="utf-8", errors="replace"))
        if isinstance(parsed, list):
            if parsed and all(isinstance(row, dict) for row in parsed):
                return pd.DataFrame(parsed)
            return pd.DataFrame({"value": parsed})
        if isinstance(parsed, dict):
            for value in parsed.values():
                if isinstance(value, list) and value and all(isinstance(row, dict) for row in value):
                    return pd.DataFrame(value)
            return pd.DataFrame([parsed])
        return pd.DataFrame({"value": [parsed]})

    raise HTTPException(status_code=400, detail="Unsupported table file type")


def _json_safe_value(value: Any) -> Any:
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, (list, dict, tuple)):
        return json.dumps(value, ensure_ascii=False)
    if pd.isna(value):
        return ""
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return str(value)
    return value


def _build_tree(path: Path) -> dict:
    if path.is_file():
        st = path.stat()
        return {
            "name": path.name,
            "type": "file",
            "size": st.st_size,
            "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
        }

    children = sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    return {
        "name": path.name,
        "type": "dir",
        "children": [_build_tree(child) for child in children],
    }


@router.get("/sessions")
def list_sessions():
    if not SESSIONS_ROOT.exists():
        return {"sessions": []}

    sessions = [p.name for p in SESSIONS_ROOT.iterdir() if p.is_dir()]
    sessions.sort(reverse=True)
    return {"sessions": sessions}


@router.get("/tree")
def get_session_tree(session: str = Query(default_factory=_session_name_now)):
    session_path = SESSIONS_ROOT / _safe_name(session, fallback=_session_name_now())
    if not session_path.exists():
        return {
            "session": session,
            "exists": False,
            "tree": {
                "name": session,
                "type": "dir",
                "children": [],
            },
        }

    return {
        "session": session,
        "exists": True,
        "tree": _build_tree(session_path),
    }


@router.get("/file")
def get_result_file(
    session: str,
    relpath: str,
    max_chars: int = Query(10000, ge=200, le=200000),
):
    safe_session = _safe_name(session, fallback=_session_name_now())
    target = _resolve_target(safe_session, relpath)

    text = target.read_text(encoding="utf-8", errors="replace")
    truncated = len(text) > max_chars
    if truncated:
        text = text[:max_chars]

    return {
        "session": safe_session,
        "relpath": relpath,
        "truncated": truncated,
        "content": text,
    }


@router.get("/asset")
def get_result_asset(session: str, relpath: str):
    safe_session = _safe_name(session, fallback=_session_name_now())
    target = _resolve_target(safe_session, relpath)

    ext = target.suffix.lower()
    if ext not in IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Asset preview supports image files only")

    media_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    return FileResponse(path=target, media_type=media_type, filename=target.name)


@router.get("/table")
def get_result_table(
    session: str,
    relpath: str,
    max_rows: int = Query(200, ge=10, le=2000),
):
    safe_session = _safe_name(session, fallback=_session_name_now())
    target = _resolve_target(safe_session, relpath)

    ext = target.suffix.lower()
    if ext not in TABLE_EXTS:
        raise HTTPException(status_code=400, detail="Table preview supports csv/tsv/xlsx/xls/json")

    try:
        df = _read_table_file(target)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse table file: {exc}") from exc

    total_rows = int(len(df.index))
    total_cols = int(len(df.columns))
    truncated = total_rows > max_rows
    preview_df = df.head(max_rows)

    rows: list[list[Any]] = []
    for row in preview_df.itertuples(index=False, name=None):
        rows.append([_json_safe_value(value) for value in row])

    return {
        "session": safe_session,
        "relpath": relpath,
        "columns": [str(col) for col in preview_df.columns.tolist()],
        "rows": rows,
        "total_rows": total_rows,
        "total_cols": total_cols,
        "truncated": truncated,
    }


@router.post("/runs")
def save_result_run(req: ResultLogRequest):
    now = datetime.now()
    session = _session_name_now()

    engine_name = _safe_name(req.engine, fallback="engine")
    ticker_name = _safe_name(req.ticker or "MIXED", fallback="MIXED")
    ts = now.strftime("%H-%M-%S-%f")[:-3]

    out_dir = SESSIONS_ROOT / session / engine_name
    out_dir.mkdir(parents=True, exist_ok=True)

    out_file = out_dir / f"{ts}_{ticker_name}.json"

    payload = {
        "timestamp": now.isoformat(),
        "session": session,
        "engine": req.engine,
        "ticker": req.ticker,
        "market": req.market,
        "source": req.source,
        "summary": req.summary,
        "payload": req.payload,
    }

    out_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    table_seed_summary = {
        "engine": req.engine,
        "ticker": req.ticker,
        "market": req.market,
        "source": req.source,
        **(req.summary or {}),
    }
    df = _extract_table_from_payload(table_seed_summary, req.payload or {})

    csv_file = out_file.with_suffix(".csv")
    xlsx_file = out_file.with_suffix(".xlsx")
    df.to_csv(csv_file, index=False)

    excel_saved = False
    try:
        df.to_excel(xlsx_file, index=False)
        excel_saved = True
    except Exception:
        excel_saved = False

    return {
        "ok": True,
        "session": session,
        "path": str(out_file).replace("\\", "/"),
        "csv_path": str(csv_file).replace("\\", "/"),
        "xlsx_path": str(xlsx_file).replace("\\", "/") if excel_saved else None,
    }
