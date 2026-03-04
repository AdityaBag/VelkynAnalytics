# Velkyn Analytics Platform

A local-first, full-stack quantitative analytics platform for options research, model comparison, and live market context.

Velkyn Analytics combines a FastAPI backend, modular pricing engines, and a single-page frontend to deliver:
- Monte Carlo pricing with diagnostics
- Black-Scholes pricing, Greeks, and implied volatility
- Binomial tree pricing (European/American) and convergence checks
- Volatility smile/surface analysis
- Scenario stress testing across spot/vol shocks
- Multi-rate sensitivity analysis
- Batch pricing across multiple tickers
- Historical run logging and replay
- Session-based results browser (charts/tables/files)
- Live market quote and intraday series panels

---

## 1. Product Scope

### What this project is
Velkyn Analytics is an analytical workstation for quant developers, researchers, and students who need fast iteration across multiple valuation methods while keeping a unified operational view.

### What this project is not
- Not a brokerage execution terminal
- Not a portfolio OMS/PMS
- Not a production HFT stack

It is intentionally optimized for local quant R&D workflows and controlled extension toward cloud deployment.

---

## 2. System Architecture

```text
Frontend SPA (HTML/CSS/JS + Chart.js)
        |
        | HTTP JSON
        v
FastAPI Backend (router modules)
        |
        +--> Quant Engines (mc, bs, binomial, vol, scenario, multi-rate, batch)
        +--> Data Services (yfinance-based live feed adapter)
        +--> Persistence (history JSONL + timestamped results folders)
```

### Runtime topology (default)
- Frontend: `http://127.0.0.1:5500`
- Backend: `http://127.0.0.1:8000`
- Swagger docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### Router prefix note
Current endpoint paths include repeated segments (example: `/mc/mc/run`) because app-level and router-level prefixes are both defined.

---

## 3. Repository Layout

```text
Quant-Pricing-Engine/
├── backend/
│   ├── main.py
│   └── routers/
│       ├── mc.py
│       ├── bs.py
│       ├── binomial.py
│       ├── vol.py
│       ├── scenario.py
│       ├── multi_rate.py
│       ├── batch.py
│       ├── history.py
│       ├── live.py
│       ├── results.py
│       └── report_agent.py
├── frontend/
│   ├── index.html
│   ├── scripts/
│   └── styles/
├── mc_engine/
├── bs_engine/
├── binomial_engine/
├── vol_engine/
├── data_engine/
├── export_engine/
├── orchestration_engine/
├── plot_engine/
├── live/
├── analysis/
├── results/
├── run_all_rates.py
├── run_backend.bat
└── requirements.txt
```

---

## 4. Engine Catalogue

### Monte Carlo Engine
- Purpose: stochastic option pricing under GBM with uncertainty diagnostics
- Capabilities: basic, antithetic, control variate, moment matching, variable-day horizon
- Primary output: price, standard error, confidence interval, path samples, terminal distribution
- API: `POST /mc/mc/run`

### Black-Scholes Engine
- Purpose: analytical valuation and sensitivity decomposition
- Capabilities: pricing, Greeks, implied volatility solving
- APIs:
  - `POST /bs/bs/pricing`
  - `POST /bs/bs/greeks`
  - `POST /bs/bs/iv`

### Binomial Engine
- Purpose: lattice-based valuation and convergence behavior
- Capabilities: European, American, convergence sweep vs analytical benchmark
- APIs:
  - `POST /binomial/binomial/european`
  - `POST /binomial/binomial/american`
  - `POST /binomial/binomial/convergence`

### Volatility Engine
- Purpose: synthetic implied-vol structure exploration
- Capabilities: smile and surface generation
- APIs:
  - `POST /vol/vol/smile`
  - `POST /vol/vol/surface`

### Scenario Engine
- Purpose: stress valuation under joint spot/volatility shocks
- Capability: grid-style repricing over shock vectors
- API: `POST /scenario/scenario/run`

### Multi-Rate Engine
- Purpose: price sensitivity to risk-free rate regimes
- API: `POST /multi-rate/multi-rate/run`

### Batch Engine
- Purpose: run pricing across multiple selected instruments
- API: `POST /batch/batch/run`

### History Engine
- Purpose: persist and retrieve run metadata for auditability
- APIs:
  - `POST /history/history/runs`
  - `GET /history/history/runs`
  - `DELETE /history/history/runs`

### Live Market Engine
- Purpose: quote and rolling series for stock/crypto symbols
- Data source: Yahoo Finance adapter
- API: `POST /live/live/quote`

### Results Engine
- Purpose: browse generated artifacts by session and preview files
- APIs:
  - `GET /results/results/sessions`
  - `GET /results/results/tree`
  - `GET /results/results/file`
  - `GET /results/results/asset`
  - `GET /results/results/table`
  - `POST /results/results/runs`

### Report Agent
- Purpose: assemble report-oriented outputs from run artifacts
- API:
  - `GET /report-agent/report-agent/meta`
  - `POST /report-agent/report-agent/train`
  - `POST /report-agent/report-agent/generate`

---

## 5. API Surface (Quick Reference)

Base URL: `http://127.0.0.1:8000`

- `GET /`
- `GET /health`
- `POST /mc/mc/run`
- `POST /bs/bs/pricing`
- `POST /bs/bs/greeks`
- `POST /bs/bs/iv`
- `POST /binomial/binomial/european`
- `POST /binomial/binomial/american`
- `POST /binomial/binomial/convergence`
- `POST /vol/vol/smile`
- `POST /vol/vol/surface`
- `POST /scenario/scenario/run`
- `POST /multi-rate/multi-rate/run`
- `POST /batch/batch/run`
- `POST /history/history/runs`
- `GET /history/history/runs`
- `DELETE /history/history/runs`
- `POST /live/live/quote`
- `GET /results/results/sessions`
- `GET /results/results/tree`
- `GET /results/results/file`
- `GET /results/results/asset`
- `GET /results/results/table`
- `POST /results/results/runs`
- `GET /report-agent/report-agent/meta`
- `POST /report-agent/report-agent/train`
- `POST /report-agent/report-agent/generate`

---

## 6. Setup and Local Run

## Prerequisites
- Python 3.10+
- `pip`
- Static web server capability (VS Code Live Server or Python HTTP server)

## Install dependencies
```bash
pip install -r requirements.txt
```

## Start backend
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

## Start frontend (example)
From the `frontend/` directory:
```bash
python -m http.server 5500
```

Then open:
- `http://127.0.0.1:5500/index.html`

---

## 6B. Public One-Link Deployment (Render + GitHub)

This repository includes `render.yaml` to deploy the full app (FastAPI + static frontend) as one web service.

### Steps
1. Push this project to a GitHub repository.
2. In Render, choose **New +** → **Blueprint** and connect the repo.
3. Render will detect `render.yaml` and create service `velkynanalytics`.
4. After deploy, open your Render URL (for example: `https://velkynanalytics.onrender.com`).

No local frontend/backend startup is required for end users when hosted this way.

---

## 7. Data and Persistence

### History log
- File: `results/data/history_runs.jsonl`
- Purpose: append-only run metadata for replay/audit panel

### Results sessions
- Organized by timestamp/session under `results/`
- Supports tree exploration and preview in the frontend Results page

---

## 8. Frontend Workflow Model

The SPA uses page-level engine modules. The standard user flow is:
1. Run an engine on its dedicated page.
2. View chart/table outputs in that page.
3. Navigate to Dashboard for cross-engine summary.
4. Use Results for generated artifact browsing.

Inter-module updates are communicated with shared browser events and lightweight state objects.

---

## 9. Security and Operational Notes

- CORS is currently permissive for local development (`allow_origins=["*"]`).
- No authentication/authorization layer is enabled by default.
- No secret management vault is integrated yet.

For production deployment, implement:
- AuthN/AuthZ (JWT/session + role model)
- strict CORS allowlist
- TLS termination
- request throttling/rate limiting
- structured audit logging

---

## 10. CI/CD and Deployment Roadmap

### Recommended CI pipeline
1. Lint and static checks (Python + frontend)
2. Unit/integration tests for engine and router contracts
3. Build and package artifacts
4. Security scans (dependency + container)
5. Staged deployment with smoke tests

### Recommended deployment model
- Containerized backend (Docker)
- Frontend served via static host/CDN
- Reverse proxy/API gateway for routing and TLS
- Observability stack (logs, metrics, traces)

---

## 11. Engineering Standards

- Keep engines pure and testable where possible.
- Maintain strict request/response contracts in router schemas.
- Preserve deterministic defaults for reproducible local runs.
- Add non-breaking API changes first; deprecate before removal.
- Keep frontend modules isolated by engine responsibility.

---

## 12. Troubleshooting

### Backend unavailable
- Confirm process on port `8000`
- Open `http://127.0.0.1:8000/docs`

### Frontend loads but no data
- Confirm frontend host is active on port `5500`
- Check browser dev tools network calls to backend
- Verify endpoint paths include duplicate prefix segments

### Live data seems stale
- Re-run backend
- Refresh frontend with cache-busting query (for active iteration)

---

## 13. License and Use

This repository currently has no explicit open-source license file in-project. Treat usage and distribution as private/internal unless a license is added by the owner.
