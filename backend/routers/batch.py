from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from bs_engine.pricing import bs_call_price, bs_put_price


router = APIRouter(prefix="/batch", tags=["Batch"])


STOCK_CATALOG = {
    "AAPL": {"market": "NASDAQ", "spot": 185.0},
    "MSFT": {"market": "NASDAQ", "spot": 420.0},
    "GOOGL": {"market": "NASDAQ", "spot": 175.0},
    "AMZN": {"market": "NASDAQ", "spot": 180.0},
    "NVDA": {"market": "NASDAQ", "spot": 130.0},
    "TSLA": {"market": "NASDAQ", "spot": 210.0},
    "META": {"market": "NASDAQ", "spot": 485.0},
    "PLTR": {"market": "NASDAQ", "spot": 25.0},
    "AI": {"market": "NYSE", "spot": 29.0},
    "UPST": {"market": "NASDAQ", "spot": 28.0},
    "JPM": {"market": "NYSE", "spot": 200.0},
    "BAC": {"market": "NYSE", "spot": 38.0},
}


class BatchRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=1)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    sigma: float = Field(..., gt=0)
    option_type: Literal["call", "put"] = "call"


@router.post("/run")
def run_batch(req: BatchRequest):
    results = []

    for ticker in req.tickers:
        symbol = ticker.upper().strip()
        meta = STOCK_CATALOG.get(symbol)
        if not meta:
            continue

        S = float(meta["spot"])
        if req.option_type == "call":
            price = bs_call_price(S, req.K, req.T, req.r, req.sigma)
        else:
            price = bs_put_price(S, req.K, req.T, req.r, req.sigma)

        results.append(
            {
                "ticker": symbol,
                "market": meta["market"],
                "spot": S,
                "price": float(price),
            }
        )

    return {
        "count": len(results),
        "option_type": req.option_type,
        "K": req.K,
        "T": req.T,
        "r": req.r,
        "sigma": req.sigma,
        "results": results,
    }
