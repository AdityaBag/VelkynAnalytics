from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from backend.routers.mc import router as mc_router
from backend.routers.bs import router as bs_router
from backend.routers.binomial import router as binomial_router
from backend.routers.vol import router as vol_router
from backend.routers.batch import router as batch_router
from backend.routers.multi_rate import router as multi_rate_router
from backend.routers.scenario import router as scenario_router
from backend.routers.history import router as history_router
from backend.routers.live import router as live_router
from backend.routers.results import router as results_router
from backend.routers.report_agent import router as report_agent_router

app = FastAPI()

# Allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Monte Carlo engine
app.include_router(mc_router, prefix="/mc")
app.include_router(bs_router, prefix="/bs")
app.include_router(binomial_router, prefix="/binomial")
app.include_router(vol_router, prefix="/vol")
app.include_router(batch_router, prefix="/batch")
app.include_router(multi_rate_router, prefix="/multi-rate")
app.include_router(scenario_router, prefix="/scenario")
app.include_router(history_router, prefix="/history")
app.include_router(live_router, prefix="/live")
app.include_router(results_router, prefix="/results")
app.include_router(report_agent_router, prefix="/report-agent")

@app.get("/health")
def health():
    return {"status": "backend running"}

FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
