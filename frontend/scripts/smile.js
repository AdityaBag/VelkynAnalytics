const VOL_BASE = `${window.__VELKYN_API_ORIGIN}/vol/vol`;
let smileChart = null;
let surfaceChart = null;

function publishDashShared(key, payload) {
    window.__qpsDashShared = window.__qpsDashShared || {};
    window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
    try {
        document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
    } catch (_) {}
}

async function postVol(endpoint, payload) {
    const res = await fetch(`${VOL_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);
    return data;
}

async function runVolSmile() {
    const empty = document.getElementById("vol-smile-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("Vol Smile", 1800, "Computing implied vol smile");

    const payload = {
        S: parseFloat(document.getElementById("vs-s").value),
        T: parseFloat(document.getElementById("vs-t").value),
        r: parseFloat(document.getElementById("vs-r").value),
        sigma_base: parseFloat(document.getElementById("vs-sigma").value),
        strike_min: parseFloat(document.getElementById("vs-kmin").value),
        strike_max: parseFloat(document.getElementById("vs-kmax").value),
        n_strikes: parseInt(document.getElementById("vs-n").value, 10),
    };

    try {
        const data = await postVol("smile", payload);
        document.getElementById("vol-smile-wrap").style.display = "block";
        drawSmile(data);
        publishDashShared("vol", { source: "vol-smile", input: payload, result: data });
        if (typeof logRun === "function") {
            logRun("Vol Smile", document.getElementById("vs-ticker").value, document.getElementById("vs-market").value, { points: data.implied_vol.length });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Smile ready");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

function drawSmile(data) {
    const ctx = document.getElementById("volSmileChart").getContext("2d");
    if (smileChart) smileChart.destroy();

    smileChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.strikes.map(v => Number(v).toFixed(1)),
            datasets: [{
                label: "Implied Vol",
                data: data.implied_vol,
                borderColor: "rgba(16,185,129,0.95)",
                backgroundColor: "rgba(16,185,129,0.18)",
                borderWidth: 2,
                pointRadius: 1,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#8b9bb5" } } },
            scales: { x: { ticks: { color: "#8b9bb5" } }, y: { ticks: { color: "#8b9bb5" } } },
        },
    });
}

async function runVolSurface() {
    const empty = document.getElementById("vol-surface-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("Vol Surface", 2300, "Building volatility surface");

    const strikes = document.getElementById("vsurf-strikes").value.split(",").map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v));
    const maturities = document.getElementById("vsurf-mats").value.split(",").map(v => parseFloat(v.trim())).filter(v => Number.isFinite(v));

    const payload = {
        S: parseFloat(document.getElementById("vsurf-s").value),
        r: parseFloat(document.getElementById("vsurf-r").value),
        sigma_base: parseFloat(document.getElementById("vsurf-sigma").value),
        strikes,
        maturities,
    };

    try {
        const data = await postVol("surface", payload);
        document.getElementById("vol-surface-wrap").style.display = "block";
        drawSurfaceHeat(data);
        if (typeof logRun === "function") {
            logRun("Vol Surface", document.getElementById("vsurf-ticker").value, document.getElementById("vsurf-market").value, { rows: data.surface.length });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Surface ready");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

function drawSurfaceHeat(data) {
    const ctx = document.getElementById("volSurfaceChart").getContext("2d");
    if (surfaceChart) surfaceChart.destroy();

    const labels = [];
    const values = [];
    data.maturities.forEach((t, i) => {
        data.strikes.forEach((k, j) => {
            labels.push(`T=${t},K=${k}`);
            values.push(data.surface[i][j]);
        });
    });

    surfaceChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Surface IV",
                data: values,
                backgroundColor: values.map((_, i) => i % 2 === 0 ? "rgba(59,130,246,0.58)" : "rgba(139,92,246,0.58)"),
                borderColor: "rgba(148,163,184,0.9)",
                borderWidth: 1,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#8b9bb5" } } },
            scales: {
                x: { ticks: { color: "#8b9bb5", maxTicksLimit: 12 } },
                y: { ticks: { color: "#8b9bb5" } },
            },
        },
    });
}

console.log("Volatility module loaded.");
