/* =========================================================
   MONTE CARLO — METHOD PICKER
   ========================================================= */
let MC_METHOD = "basic";
const MC_RUN_URL = `${window.__VELKYN_API_ORIGIN}/mc/mc/run`;
const MC_SHARED_KEY = "qps_mc_latest_result";

function publishMcResult(payload, data) {
    const snapshot = {
        source: "mc-page",
        timestamp: Date.now(),
        input: {
            ticker: payload.ticker,
            market: payload.market,
            S0: payload.S0,
            K: payload.K,
            sigma: payload.sigma,
            r: payload.r,
            T: payload.T,
            M: payload.M,
            n: payload.n,
            option_type: payload.option_type,
            method: payload.method,
        },
        result: {
            price: data?.price,
            stderr: data?.stderr,
            ci_low: data?.ci_low,
            ci_high: data?.ci_high,
            paths_sample: Array.isArray(data?.paths_sample) ? data.paths_sample : [],
            terminal: Array.isArray(data?.terminal)
                ? data.terminal
                : (Array.isArray(data?.terminal_stats?.S_T) ? data.terminal_stats.S_T : []),
            terminal_stats: data?.terminal_stats || {},
        },
    };

    window.__qpsMcLatest = snapshot;
    try {
        localStorage.setItem(MC_SHARED_KEY, JSON.stringify(snapshot));
    } catch (_) {}

    try {
        document.dispatchEvent(new CustomEvent("qps:mc-updated", { detail: snapshot }));
    } catch (_) {}
}

function pickM(el) {
    document.querySelectorAll('#mc .m-opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
    MC_METHOD = el.dataset.method;
}

/* =========================================================
   MONTE CARLO — RUN SIMULATION
   ========================================================= */
async function runMC() {
    const empty = document.getElementById('empt');
    empty.style.display = 'none';

    const requestedPaths = parseInt(document.getElementById('mc-n').value, 10);
    const requestedSteps = parseInt(document.getElementById('mc-steps').value, 10);
    const safePaths = Number.isFinite(requestedPaths) && requestedPaths > 0 ? requestedPaths : 20000;
    const safeSteps = Number.isFinite(requestedSteps) && requestedSteps > 0 ? requestedSteps : 252;

    const payload = {
        ticker: document.getElementById('mc-ticker').value,
        market: document.getElementById('mc-market').value,
        S0: parseFloat(document.getElementById('mc-s0').value),
        K: parseFloat(document.getElementById('mc-k').value),
        sigma: parseFloat(document.getElementById('mc-sig').value),
        r: parseFloat(document.getElementById('mc-r').value),
        T: parseFloat(document.getElementById('mc-t').value),

        // Backend expects M (paths) and n (steps)
        M: safePaths,
        n: safeSteps,

        // Backend expects option_type, not type
        option_type: document.getElementById('mc-type').value,

        method: MC_METHOD,

        // Required by backend schema
        days: parseInt(document.getElementById('mc-days').value, 10),
        seed: 0,
        sample_paths: safePaths
    };

    const expectedMs = Math.max(1000, Math.min(30000, Math.round((safePaths * safeSteps) / 700)));
    if (window.engineLoader) {
        window.engineLoader.start('Monte Carlo', expectedMs, `Simulating ${safePaths} paths × ${safeSteps} steps`);
    }

    let res;
    try {
        res = await fetch(MC_RUN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("MC fetch error:", e);
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = 'block';
        empty.textContent = "Backend not reachable.";
        return;
    }

    if (!res.ok) {
        if (window.engineLoader) window.engineLoader.stop(false);
        let detail = "Backend error.";
        try {
            const err = await res.json();
            if (err?.detail) {
                detail = `Backend error: ${err.detail}`;
            }
        } catch (_) {
            detail = `Backend error (${res.status}).`;
        }
        console.error("MC backend error:", res.status, detail);
        empty.style.display = 'block';
        empty.textContent = detail;
        return;
    }

    const data = await res.json();
    if (window.engineLoader) window.engineLoader.stop(true, 'Monte Carlo complete');

    // Update numeric results
    document.getElementById("mc-price").textContent = data.price.toFixed(4);
    document.getElementById("mc-se").textContent = data.stderr.toFixed(4);
    document.getElementById("mc-ci").textContent =
        `[${data.ci_low.toFixed(4)}, ${data.ci_high.toFixed(4)}]`;

    // Reveal result blocks
    revealMCResults();

    // Draw charts
    const paths = Array.isArray(data.paths_sample) ? data.paths_sample : (Array.isArray(data.paths) ? data.paths : []);
    const terminal = Array.isArray(data.terminal)
        ? data.terminal
        : (Array.isArray(data?.terminal_stats?.S_T) ? data.terminal_stats.S_T : []);

    if (paths.length > 0) {
        drawPaths(paths);
    }
    if (terminal.length > 0) {
        drawDist(terminal);
    }

    publishMcResult(payload, data);

    if (typeof logRun === "function") {
        logRun(payload.method === "variable_days" ? "MC Variable Days" : "Monte Carlo", payload.ticker, payload.market, {
            option_type: payload.option_type,
            method: payload.method,
            price: data.price,
        });
    }
}

/* =========================================================
   UI REVEAL ANIMATION
   ========================================================= */
function revealMCResults() {
    const seq = [
        ['rh', 'grid'],
        ['cpaths', 'block'],
        ['cdist', 'block']
    ];

    seq.forEach(([id, display], i) => {
        const el = document.getElementById(id);
        el.style.display = display;
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';

        setTimeout(() => {
            el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, i * 120);
    });
}

/* =========================================================
   CHARTS
   ========================================================= */
let pathsChart = null;
let distChart = null;

function drawPaths(paths) {
    const ctx = document.getElementById("pathsChart").getContext("2d");
    if (pathsChart) pathsChart.destroy();

    const steps = paths[0].length;
    const labels = Array.from({ length: steps }, (_, i) => i);
    const colorForPath = (index, total) => {
        const ratio = (index % Math.max(total, 1)) / Math.max(total, 1);
        const angle = ratio * Math.PI * 2;
        const r = Math.round(127 * (Math.sin(angle) + 1));
        const g = Math.round(127 * (Math.sin(angle + (2 * Math.PI / 3)) + 1));
        const b = Math.round(127 * (Math.sin(angle + (4 * Math.PI / 3)) + 1));
        return `rgba(${r}, ${g}, ${b}, 0.98)`;
    };

    pathsChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: paths.map((p, i) => ({
                label: `Path ${i + 1}`,
                data: p,
                borderColor: colorForPath(i, paths.length),
                backgroundColor: "transparent",
                borderWidth: 1.2,
                pointRadius: 0
            }))
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { ticks: { color: "#8b9bb5" } }
            }
        }
    });
}

function drawDist(terminal) {
    const ctx = document.getElementById("distChart").getContext("2d");
    if (distChart) distChart.destroy();

    const bins = 40;
    const min = Math.min(...terminal);
    const max = Math.max(...terminal);
    const width = (max - min) / bins || 1;

    const counts = new Array(bins).fill(0);
    terminal.forEach(v => {
        const idx = Math.min(Math.floor((v - min) / width), bins - 1);
        counts[idx]++;
    });

    const labels = counts.map((_, i) => (min + i * width).toFixed(2));

    distChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Terminal Prices",
                data: counts,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { chartArea } = chart;
                    if (!chartArea) return "rgba(0, 180, 255, 0.88)";

                    const grad = chart.ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    grad.addColorStop(0.00, "rgba(0, 0, 0, 0.96)");
                    grad.addColorStop(0.15, "rgba(0, 120, 255, 0.95)");
                    grad.addColorStop(1.00, "rgba(0, 235, 255, 0.98)");
                    return grad;
                },
                borderColor: "rgba(0, 190, 255, 0.98)",
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10,
                        color: "#8b9bb5"
                    }
                },
                y: {
                    ticks: {
                        color: "#8b9bb5"
                    }
                }
            }
        }
    });
}

console.log("Monte Carlo module loaded (v20260226-1).");
