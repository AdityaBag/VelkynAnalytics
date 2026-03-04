from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Literal

from bs_engine.pricing import bs_call_price, bs_put_price


router = APIRouter(prefix="/scenario", tags=["Scenario"])


class ScenarioRequest(BaseModel):
    S: float = Field(..., gt=0)
    K: float = Field(..., gt=0)
    T: float = Field(..., gt=0)
    r: float = Field(...)
    sigma: float = Field(..., gt=0)
    option_type: Literal["call", "put"] = "call"
    spot_shocks: list[float] = Field(default_factory=lambda: [-0.1, 0.0, 0.1])
    vol_shocks: list[float] = Field(default_factory=lambda: [-0.2, 0.0, 0.2])


@router.post("/run")
def run_scenario(req: ScenarioRequest):
    rows = []

    for s_shock in req.spot_shocks:
        for v_shock in req.vol_shocks:
            shocked_S = max(1e-6, req.S * (1.0 + s_shock))
            shocked_sigma = max(1e-6, req.sigma * (1.0 + v_shock))

            if req.option_type == "call":
                px = bs_call_price(shocked_S, req.K, req.T, req.r, shocked_sigma)
            else:
                px = bs_put_price(shocked_S, req.K, req.T, req.r, shocked_sigma)

            rows.append(
                {
                    "spot_shock": float(s_shock),
                    "vol_shock": float(v_shock),
                    "S": float(shocked_S),
                    "sigma": float(shocked_sigma),
                    "price": float(px),
                }
            )

    return {
        "base": {
            "S": req.S,
            "K": req.K,
            "T": req.T,
            "r": req.r,
            "sigma": req.sigma,
            "option_type": req.option_type,
        },
        "scenarios": rows,
    }
