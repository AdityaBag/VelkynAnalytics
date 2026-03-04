from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from bs_engine.pricing import bs_call_price, bs_put_price


router = APIRouter(prefix="/multi-rate", tags=["Multi-Rate"])


STOCK_SPOTS = {
    "AAPL": 185.0,
    "MSFT": 420.0,
    "GOOGL": 175.0,
    "AMZN": 180.0,
    "NVDA": 130.0,
    "TSLA": 210.0,
    "META": 485.0,
    "PLTR": 25.0,
    "AI": 29.0,
    "UPST": 28.0,
    "JPM": 200.0,
    "BAC": 38.0,
}


class MultiRateRequest(BaseModel):
    ticker: str = Field(...)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    sigma: float = Field(..., gt=0)
    option_type: Literal["call", "put"] = "call"
    rates: list[float] = Field(default_factory=lambda: [0.01, 0.03, 0.05])


@router.post("/run")
def run_multi_rate(req: MultiRateRequest):
    ticker = req.ticker.upper().strip()
    S = STOCK_SPOTS.get(ticker, 100.0)

    out = []
    for r in req.rates:
        if req.option_type == "call":
            px = bs_call_price(S, req.K, req.T, r, req.sigma)
        else:
            px = bs_put_price(S, req.K, req.T, r, req.sigma)
        out.append({"rate": float(r), "price": float(px)})

    return {
        "ticker": ticker,
        "spot": float(S),
        "option_type": req.option_type,
        "K": req.K,
        "T": req.T,
        "sigma": req.sigma,
        "series": out,
    }
