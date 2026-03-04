from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from binomial_engine.pricing import binomial_option_price
from bs_engine.pricing import bs_call_price, bs_put_price


router = APIRouter(prefix="/binomial", tags=["Binomial"])


class BinomialRequest(BaseModel):
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    sigma: float = Field(..., gt=0)
    N: int = Field(200, ge=10)
    option_type: Literal["call", "put"] = "call"


class BinomialConvergenceRequest(BaseModel):
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    sigma: float = Field(..., gt=0)
    n_start: int = Field(25, ge=5)
    n_end: int = Field(500, ge=10)
    n_step: int = Field(25, ge=1)
    option_type: Literal["call", "put"] = "call"


@router.post("/european")
def price_european(req: BinomialRequest):
    price = binomial_option_price(
        S0=req.S,
        K=req.K,
        T=req.T,
        r=req.r,
        sigma=req.sigma,
        N=req.N,
        option_type=req.option_type,
        american=False,
    )
    bs_price = bs_call_price(req.S, req.K, req.T, req.r, req.sigma) if req.option_type == "call" else bs_put_price(req.S, req.K, req.T, req.r, req.sigma)
    return {
        "model": "CRR",
        "style": "european",
        "option_type": req.option_type,
        "price": float(price),
        "bs_benchmark": float(bs_price),
        "abs_diff": float(abs(price - bs_price)),
        "N": req.N,
    }


@router.post("/american")
def price_american(req: BinomialRequest):
    price = binomial_option_price(
        S0=req.S,
        K=req.K,
        T=req.T,
        r=req.r,
        sigma=req.sigma,
        N=req.N,
        option_type=req.option_type,
        american=True,
    )
    return {
        "model": "CRR",
        "style": "american",
        "option_type": req.option_type,
        "price": float(price),
        "N": req.N,
    }


@router.post("/convergence")
def convergence(req: BinomialConvergenceRequest):
    ns = list(range(req.n_start, req.n_end + 1, req.n_step))
    prices = [
        binomial_option_price(
            S0=req.S,
            K=req.K,
            T=req.T,
            r=req.r,
            sigma=req.sigma,
            N=n,
            option_type=req.option_type,
            american=False,
        )
        for n in ns
    ]

    bs_price = bs_call_price(req.S, req.K, req.T, req.r, req.sigma) if req.option_type == "call" else bs_put_price(req.S, req.K, req.T, req.r, req.sigma)

    return {
        "option_type": req.option_type,
        "N": ns,
        "prices": [float(p) for p in prices],
        "bs_benchmark": float(bs_price),
    }
