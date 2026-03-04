const RUNLOG_BASE = `${window.__VELKYN_API_ORIGIN}/history/history`;
const RESULTS_BASE = `${window.__VELKYN_API_ORIGIN}/results/results`;

async function logRun(engine, ticker, market, summary = {}) {
    try {
        await fetch(`${RUNLOG_BASE}/runs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                engine,
                ticker,
                market,
                summary,
                timestamp: new Date().toISOString(),
            }),
        });
    } catch (_) {
    }

    try {
        await fetch(`${RESULTS_BASE}/runs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                engine,
                ticker,
                market,
                source: "frontend-runlog",
                summary,
                payload: {},
            }),
        });
    } catch (_) {
    }
}
