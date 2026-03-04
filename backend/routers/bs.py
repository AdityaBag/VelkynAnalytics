from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from typing import Literal

from bs_engine.pricing import bs_call_price, bs_put_price, bs_d1_d2
from bs_engine.greeks import bs_delta, bs_gamma, bs_vega, bs_theta, bs_rho


router = APIRouter(prefix="/bs", tags=["Black-Scholes"])


class BSPricingRequest(BaseModel):
    ticker: Optional[str] = Field(None)
    market: Optional[str] = Field(None)
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    sigma: float = Field(..., gt=0)
    option_type: Literal["call", "put"] = "call"


class BSIVRequest(BaseModel):
    ticker: Optional[str] = Field(None)
    market: Optional[str] = Field(None)
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    market_price: float = Field(..., gt=0)
    option_type: Literal["call", "put"] = "call"
    tol: float = Field(1e-6, gt=0)
    max_iter: int = Field(100, ge=10, le=1000)


def _price_for_type(S: float, K: float, T: float, r: float, sigma: float, option_type: str) -> float:
    if option_type == "call":
        return float(bs_call_price(S, K, T, r, sigma))
    return float(bs_put_price(S, K, T, r, sigma))


@router.post("/pricing")
def run_bs_pricing(req: BSPricingRequest):
    d1, d2 = bs_d1_d2(req.S, req.K, req.T, req.r, req.sigma)
    call_price = float(bs_call_price(req.S, req.K, req.T, req.r, req.sigma))
    put_price = float(bs_put_price(req.S, req.K, req.T, req.r, req.sigma))

    return {
        "ticker": req.ticker,
        "market": req.market,
        "S": req.S,
        "K": req.K,
        "T": req.T,
        "r": req.r,
        "sigma": req.sigma,
        "option_type": req.option_type,
        "selected_price": call_price if req.option_type == "call" else put_price,
        "call_price": call_price,
        "put_price": put_price,
        "d1": float(d1) if d1 is not None else None,
        "d2": float(d2) if d2 is not None else None,
    }


@router.post("/greeks")
def run_bs_greeks(req: BSPricingRequest):
    return {
        "ticker": req.ticker,
        "market": req.market,
        "S": req.S,
        "K": req.K,
        "T": req.T,
        "r": req.r,
        "sigma": req.sigma,
        "option_type": req.option_type,
        "delta": float(bs_delta(req.S, req.K, req.T, req.r, req.sigma, req.option_type)),
        "gamma": float(bs_gamma(req.S, req.K, req.T, req.r, req.sigma)),
        "vega": float(bs_vega(req.S, req.K, req.T, req.r, req.sigma)),
        "theta": float(bs_theta(req.S, req.K, req.T, req.r, req.sigma, req.option_type)),
        "rho": float(bs_rho(req.S, req.K, req.T, req.r, req.sigma, req.option_type)),
    }


@router.post("/iv")
def run_bs_iv_solver(req: BSIVRequest):
    low = 1e-4
    high = 5.0

    f_low = _price_for_type(req.S, req.K, req.T, req.r, low, req.option_type) - req.market_price
    f_high = _price_for_type(req.S, req.K, req.T, req.r, high, req.option_type) - req.market_price

    if f_low == 0.0:
        return {"implied_vol": low, "iterations": 0, "option_type": req.option_type}
    if f_high == 0.0:
        return {"implied_vol": high, "iterations": 0, "option_type": req.option_type}

    if f_low * f_high > 0:
        raise HTTPException(
            status_code=400,
            detail="Market price is outside solvable range for current inputs.",
        )

    mid = low
    iterations = 0

    for i in range(req.max_iter):
        iterations = i + 1
        mid = 0.5 * (low + high)
        f_mid = _price_for_type(req.S, req.K, req.T, req.r, mid, req.option_type) - req.market_price

        if abs(f_mid) < req.tol:
            break

        if f_low * f_mid < 0:
            high = mid
            f_high = f_mid
        else:
            low = mid
            f_low = f_mid

    model_price = _price_for_type(req.S, req.K, req.T, req.r, mid, req.option_type)

    return {
        "ticker": req.ticker,
        "market": req.market,
        "option_type": req.option_type,
        "implied_vol": float(mid),
        "iterations": iterations,
        "market_price": req.market_price,
        "model_price": float(model_price),
        "abs_error": float(abs(model_price - req.market_price)),
    }
