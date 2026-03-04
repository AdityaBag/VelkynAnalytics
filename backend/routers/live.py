from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import pandas as pd
import yfinance as yf


router = APIRouter(prefix="/live", tags=["Live"])


class LiveQuoteRequest(BaseModel):
    asset_type: str = Field(..., description="stock or crypto")
    symbol: str = Field(...)
    days: int = Field(1, ge=1, le=60, description="Historical window in days")


def _extract_price_series(df, field: str, symbol_hint: str):
    price_series = None
    if field in df.columns:
        price_series = df[field]
    elif (field, symbol_hint) in df.columns:
        price_series = df[(field, symbol_hint)]
    else:
        try:
            price_series = df.xs(field, axis=1, level=0)
        except Exception:
            price_series = None

    if price_series is None:
        return None

    if hasattr(price_series, "ndim") and price_series.ndim > 1:
        price_series = price_series.iloc[:, 0]

    try:
        price_series = price_series.astype(float).dropna()
    except Exception:
        return None

    return price_series


def _extract_close_series(df, symbol_hint: str):
    return _extract_price_series(df, "Close", symbol_hint)


def _normalize_datetime_index(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return frame

    idx = pd.to_datetime(frame.index, utc=True, errors="coerce")
    valid = ~idx.isna()
    frame = frame.loc[valid].copy()
    frame.index = idx[valid]
    return frame.sort_index()


def _extract_ohlc_df(df, symbol_hint: str):
    open_ = _extract_price_series(df, "Open", symbol_hint)
    high = _extract_price_series(df, "High", symbol_hint)
    low = _extract_price_series(df, "Low", symbol_hint)
    close = _extract_price_series(df, "Close", symbol_hint)
    volume = _extract_price_series(df, "Volume", symbol_hint)

    if open_ is None or high is None or low is None or close is None or volume is None:
        return None

    ohlc_df = pd.DataFrame(
        {
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
        }
    ).dropna()

    ohlc_df = _normalize_datetime_index(ohlc_df)

    if ohlc_df.empty:
        return None

    return ohlc_df


def _ohlc_df_to_payload(ohlc_df: pd.DataFrame, limit: int = 500):
    frame = ohlc_df.tail(limit)

    return [
        {
            "o": float(row.open),
            "h": float(row.high),
            "l": float(row.low),
            "c": float(row.close),
            "v": float(row.volume),
        }
        for row in frame.itertuples(index=False)
    ]


def _extract_ohlc(df, symbol_hint: str):
    ohlc_df = _extract_ohlc_df(df, symbol_hint)
    if ohlc_df is None:
        return None
    return _ohlc_df_to_payload(ohlc_df, limit=500)


def _latest_regular_stock_session(ohlc_df: pd.DataFrame):
    if ohlc_df is None or ohlc_df.empty:
        return None

    eastern = ohlc_df.tz_convert("America/New_York")
    regular = eastern.between_time("09:30", "16:00", inclusive="both")
    if regular.empty:
        return None

    latest_date = regular.index.max().date()
    latest_session = regular[regular.index.date == latest_date]
    if latest_session.empty:
        return None

    return latest_session.tz_convert("UTC")


def _recent_regular_stock_sessions(ohlc_df: pd.DataFrame, days: int):
    if ohlc_df is None or ohlc_df.empty:
        return None

    eastern = ohlc_df.tz_convert("America/New_York")
    regular = eastern.between_time("09:30", "16:00", inclusive="both")
    if regular.empty:
        return None

    unique_dates = sorted(set(regular.index.date))
    selected_dates = set(unique_dates[-max(1, int(days)):])
    date_index = pd.Index(regular.index.date)
    filtered = regular[date_index.isin(selected_dates)]
    if filtered.empty:
        return None

    return filtered.tz_convert("UTC")


def _stock_download_params(days: int):
    d = max(1, min(int(days), 60))
    if d <= 7:
        return "7d", "1m"
    return "60d", "5m"


def _crypto_download_params(days: int):
    d = max(1, min(int(days), 60))
    if d <= 7:
        return "7d", "1m"
    return "60d", "5m"


def _fetch_stock_quote(symbol: str, days: int):
    period, interval = _stock_download_params(days)
    data = yf.download(symbol, period=period, interval=interval, progress=False)
    if data is None or data.empty:
        raise HTTPException(status_code=404, detail=f"No stock data for {symbol}")

    ohlc_df = _extract_ohlc_df(data, symbol.upper())
    session_window = _recent_regular_stock_sessions(ohlc_df, days)

    if session_window is None:
        raise HTTPException(status_code=404, detail=f"No regular market session data for {symbol}")

    close = session_window["close"].astype(float).dropna()
    limit = max(500, min(12000, len(close)))
    ohlc = _ohlc_df_to_payload(session_window, limit=limit)

    if close is None or close.empty or ohlc is None:
        raise HTTPException(status_code=404, detail=f"No close prices for {symbol}")

    last = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) > 1 else last
    change_pct = ((last - prev) / prev * 100.0) if prev != 0 else 0.0

    series = [float(v) for v in close.tail(limit).tolist()]

    return {
        "asset_type": "stock",
        "symbol": symbol.upper(),
        "session_type": "regular",
        "session_date": str(session_window.tz_convert("America/New_York").index.max().date()),
        "days": int(days),
        "price": last,
        "change_pct": float(change_pct),
        "series": series,
        "ohlc": ohlc,
    }


def _fetch_crypto_quote(symbol: str, days: int):
    pair = symbol.upper().strip()
    yf_symbol = pair
    if pair.endswith("USDT"):
        yf_symbol = pair.replace("USDT", "-USD")

    period, interval = _crypto_download_params(days)
    data = yf.download(yf_symbol, period=period, interval=interval, progress=False)
    if data is None or data.empty:
        raise HTTPException(status_code=404, detail=f"No crypto data for {symbol}")

    close = _extract_close_series(data, yf_symbol)
    ohlc = _extract_ohlc(data, yf_symbol)

    if close is None or close.empty or ohlc is None:
        raise HTTPException(status_code=404, detail=f"No close prices for {symbol}")

    last = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) > 1 else last
    change_pct = ((last - prev) / prev * 100.0) if prev != 0 else 0.0

    limit = max(500, min(12000, len(close)))
    series = [float(v) for v in close.tail(limit).tolist()]
    ohlc = _ohlc_df_to_payload(_extract_ohlc_df(data, yf_symbol), limit=limit)

    return {
        "asset_type": "crypto",
        "symbol": pair,
        "days": int(days),
        "price": last,
        "change_pct": change_pct,
        "series": series,
        "ohlc": ohlc,
    }


@router.post("/quote")
def live_quote(req: LiveQuoteRequest):
    typ = req.asset_type.lower().strip()
    symbol = req.symbol.strip()
    days = req.days

    if typ == "stock":
        return _fetch_stock_quote(symbol, days)
    if typ == "crypto":
        return _fetch_crypto_quote(symbol, days)

    raise HTTPException(status_code=400, detail="asset_type must be 'stock' or 'crypto'")
