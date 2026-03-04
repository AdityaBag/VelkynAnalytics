from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List

from bs_engine.pricing import bs_call_price


router = APIRouter(prefix="/vol", tags=["Volatility"])


class VolSmileRequest(BaseModel):
    S: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    sigma_base: float = Field(..., gt=0)
    strike_min: float = Field(..., gt=0)
    strike_max: float = Field(..., gt=0)
    n_strikes: int = Field(25, ge=5, le=200)


class VolSurfaceRequest(BaseModel):
    S: float = Field(..., gt=0)
    r: float = Field(...)
    sigma_base: float = Field(..., gt=0)
    strikes: List[float] = Field(..., min_length=3)
    maturities: List[float] = Field(..., min_length=3)


def smile_sigma(sigma_base: float, moneyness: float) -> float:
    return float(sigma_base * (1.0 + 0.3 * (moneyness - 1.0) ** 2))


@router.post("/smile")
def run_smile(req: VolSmileRequest):
    if req.strike_max <= req.strike_min:
        req.strike_max = req.strike_min + 1.0

    step = (req.strike_max - req.strike_min) / (req.n_strikes - 1)
    strikes = [req.strike_min + i * step for i in range(req.n_strikes)]
    moneyness = [k / req.S for k in strikes]
    implied_vol = [smile_sigma(req.sigma_base, m) for m in moneyness]
    prices = [bs_call_price(req.S, k, req.T, req.r, iv) for k, iv in zip(strikes, implied_vol)]

    return {
        "strikes": [float(k) for k in strikes],
        "moneyness": [float(m) for m in moneyness],
        "implied_vol": [float(v) for v in implied_vol],
        "prices": [float(p) for p in prices],
    }


@router.post("/surface")
def run_surface(req: VolSurfaceRequest):
    strikes = [float(k) for k in req.strikes]
    maturities = [float(t) for t in req.maturities]

    surface = []
    for t in maturities:
        row = []
        for k in strikes:
            m = k / req.S
            term_adj = 1.0 + 0.05 * (t - 1.0)
            row.append(smile_sigma(req.sigma_base, m) * term_adj)
        surface.append([float(v) for v in row])

    return {
        "strikes": strikes,
        "maturities": maturities,
        "surface": surface,
    }
