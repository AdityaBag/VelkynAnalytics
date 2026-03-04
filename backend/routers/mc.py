# backend/routers/mc.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional

import numpy as np

from mc_engine.simulate import simulate_gbm_paths
from mc_engine.variable_day_mc import simulate_gbm_variable_days
from mc_engine.pricing import (
    mc_option_price,
    mc_european_call_antithetic,
    mc_european_call_control_variate,
)
from mc_engine.variance_reduction import moment_match
from mc_engine.terminal_distribution import compute_terminal_distribution

router = APIRouter(prefix="/mc", tags=["Monte Carlo"])


class MCRequest(BaseModel):
    ticker: Optional[str] = Field(None, description="Ticker symbol selected in UI")
    market: Optional[str] = Field(None, description="Market/exchange label")
    S0: float = Field(..., description="Initial price")
    K: float = Field(..., description="Strike price")
    r: float = Field(..., description="Risk-free rate (annual)")
    sigma: float = Field(..., description="Volatility (annual)")
    T: float = Field(..., description="Time to maturity in years")
    M: int = Field(10000, description="Number of Monte Carlo paths")
    n: int = Field(252, description="Number of time steps")
    option_type: Literal["call", "put"] = "call"
    method: Literal["basic", "antithetic", "control", "moment", "variable_days"] = "basic"
    days: Optional[int] = Field(
        None,
        description="Number of days for variable_days method (overrides T/n logic)",
    )
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")
    sample_paths: int = Field(
        20,
        description="Number of sample paths to return for plotting",
    )


def _compute_price_and_stats_from_paths(
    S_paths: np.ndarray,
    K: float,
    r: float,
    T: float,
    option_type: str,
) -> dict:
    """
    Helper: given simulated paths, compute price, stderr, CI, and terminal stats.
    """
    # Price from paths
    price = mc_option_price(S_paths, K, r, T, option_type=option_type)

    # Terminal payoffs for stderr / CI
    S_T = S_paths[:, -1]
    if option_type == "call":
        payoffs = np.maximum(S_T - K, 0.0)
    else:
        payoffs = np.maximum(K - S_T, 0.0)

    disc = np.exp(-r * T)
    discounted_payoffs = disc * payoffs

    M = len(discounted_payoffs)
    mean_payoff = discounted_payoffs.mean()
    std_payoff = discounted_payoffs.std(ddof=1) if M > 1 else 0.0
    stderr = std_payoff / np.sqrt(M) if M > 0 else 0.0

    ci_low = mean_payoff - 1.96 * stderr
    ci_high = mean_payoff + 1.96 * stderr

    # Terminal distribution stats
    terminal_stats = compute_terminal_distribution(S_paths)
    if isinstance(terminal_stats.get("S_T"), np.ndarray):
        terminal_stats["S_T"] = terminal_stats["S_T"].tolist()

    return {
        "price": float(price),
        "stderr": float(stderr),
        "ci_low": float(ci_low),
        "ci_high": float(ci_high),
        "terminal_stats": terminal_stats,
    }


@router.post("/run")
def run_mc(req: MCRequest):
    """
    Unified Monte Carlo endpoint for single-asset European options.
    Supports:
    - basic
    - antithetic
    - control
    - moment
    - variable_days
    """
    method = req.method
    option_type = req.option_type

    # -----------------------------
    # Dispatch by method
    # -----------------------------
    if method == "basic":
        # Use core GBM simulator
        S_paths = simulate_gbm_paths(
            S0=req.S0,
            r=req.r,
            sigma=req.sigma,
            T=req.T,
            M=req.M,
            n=req.n,
            seed=req.seed,
        )
        stats = _compute_price_and_stats_from_paths(
            S_paths=S_paths,
            K=req.K,
            r=req.r,
            T=req.T,
            option_type=option_type,
        )

    elif method == "antithetic":
        if option_type != "call":
            raise HTTPException(
                status_code=400,
                detail="mc_european_call_antithetic is implemented for calls only in current engine.",
            )

        price = mc_european_call_antithetic(
            S0=req.S0,
            K=req.K,
            T=req.T,
            r=req.r,
            sigma=req.sigma,
            M=req.M,
            n=req.n,
            seed=req.seed if req.seed is not None else 12345,
        )

        # For consistency, we still simulate paths to provide sample paths + stats
        S_paths = simulate_gbm_paths(
            S0=req.S0,
            r=req.r,
            sigma=req.sigma,
            T=req.T,
            M=req.M,
            n=req.n,
            seed=req.seed,
        )
        stats = _compute_price_and_stats_from_paths(
            S_paths=S_paths,
            K=req.K,
            r=req.r,
            T=req.T,
            option_type=option_type,
        )
        stats["price"] = float(price)

    elif method == "control":
        if option_type != "call":
            raise HTTPException(
                status_code=400,
                detail="mc_european_call_control_variate is implemented for calls only in current engine.",
            )

        price = mc_european_call_control_variate(
            S0=req.S0,
            K=req.K,
            T=req.T,
            r=req.r,
            sigma=req.sigma,
            M=req.M,
            n=req.n,
            seed=req.seed if req.seed is not None else 12345,
        )

        # Again, simulate paths for plotting + stats
        S_paths = simulate_gbm_paths(
            S0=req.S0,
            r=req.r,
            sigma=req.sigma,
            T=req.T,
            M=req.M,
            n=req.n,
            seed=req.seed,
        )
        stats = _compute_price_and_stats_from_paths(
            S_paths=S_paths,
            K=req.K,
            r=req.r,
            T=req.T,
            option_type=option_type,
        )
        stats["price"] = float(price)

    elif method == "moment":
        # Manual simulation with moment-matched normals
        if req.seed is not None:
            rng = np.random.default_rng(req.seed)
        else:
            rng = np.random.default_rng()

        dt = req.T / req.n
        mu_dt = (req.r - 0.5 * req.sigma**2) * dt
        sigma_sqrt_dt = req.sigma * np.sqrt(dt)

        Z = rng.standard_normal(size=(req.M, req.n))
        Z_mm = moment_match(Z)

        log_returns = mu_dt + sigma_sqrt_dt * Z_mm
        log_S = np.log(req.S0) + np.cumsum(log_returns, axis=1)
        S_paths = np.exp(log_S)

        stats = _compute_price_and_stats_from_paths(
            S_paths=S_paths,
            K=req.K,
            r=req.r,
            T=req.T,
            option_type=option_type,
        )

    elif method == "variable_days":
        if req.days is None:
            raise HTTPException(
                status_code=400,
                detail="days must be provided for method='variable_days'.",
            )

        S_paths = simulate_gbm_variable_days(
            S0=req.S0,
            r=req.r,
            sigma=req.sigma,
            days=req.days,
            M=req.M,
            seed=req.seed,
        )

        # Convert days to years for discounting
        T_eff = req.days / 252.0

        stats = _compute_price_and_stats_from_paths(
            S_paths=S_paths,
            K=req.K,
            r=req.r,
            T=T_eff,
            option_type=option_type,
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unknown method: {method}")

    # -----------------------------
    # Sample paths for plotting
    # -----------------------------
    sample_n = min(req.sample_paths, S_paths.shape[0])
    paths_sample = S_paths[:sample_n, :]

    return {
        "method_used": method,
        "ticker": req.ticker,
        "market": req.market,
        "option_type": option_type,
        "S0": req.S0,
        "K": req.K,
        "r": req.r,
        "sigma": req.sigma,
        "T": req.T,
        "M": req.M,
        "n": req.n,
        "sample_paths": sample_n,
        "paths_sample": paths_sample.tolist(),
        **stats,
    }
