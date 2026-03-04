const BS_BASE = `${window.__VELKYN_API_ORIGIN}/bs/bs`;
let bsGreeksChart = null;

function publishDashShared(key, payload) {
    window.__qpsDashShared = window.__qpsDashShared || {};
    window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
    try {
        document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
    } catch (_) {}
}

function bsPayload(prefix) {
    return {
        ticker: document.getElementById(`${prefix}-ticker`).value,
        market: document.getElementById(`${prefix}-market`).value,
        S: parseFloat(document.getElementById(`${prefix}-s`).value),
        K: parseFloat(document.getElementById(`${prefix}-k`).value),
        T: parseFloat(document.getElementById(`${prefix}-t`).value),
        r: parseFloat(document.getElementById(`${prefix}-r`).value),
        sigma: parseFloat(document.getElementById(`${prefix}-sigma`).value),
        option_type: document.getElementById(`${prefix}-type`).value,
    };
}

async function postJSON(url, payload) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
    });

    let body = null;
    try {
        body = await res.json();
    } catch (_) {
        body = null;
    }

    if (!res.ok) {
        const detail = body?.detail ? `Backend error: ${body.detail}` : `Backend error (${res.status}).`;
        throw new Error(detail);
    }

    return body;
}

async function runBSPricing() {
    const empty = document.getElementById("bs-pricing-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("BS Pricing", 1600, "Calculating option prices");

    try {
        const data = await postJSON(`${BS_BASE}/pricing`, bsPayload("bs"));
        document.getElementById("bs-selected").textContent = data.selected_price.toFixed(4);
        document.getElementById("bs-call").textContent = data.call_price.toFixed(4);
        document.getElementById("bs-put").textContent = data.put_price.toFixed(4);
        document.getElementById("bs-pricing-res").style.display = "grid";
        publishDashShared("bs", { source: "bs-pricing", input: bsPayload("bs"), result: data });
        if (typeof logRun === "function") {
            logRun("BS Pricing", data.ticker, data.market, { selected_price: data.selected_price, option_type: data.option_type });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "BS pricing complete");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

async function runBSGreeks() {
    const empty = document.getElementById("bs-greeks-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("BS Greeks", 1800, "Computing Greeks");

    try {
        const data = await postJSON(`${BS_BASE}/greeks`, bsPayload("bsg"));
        document.getElementById("bsg-delta").textContent = data.delta.toFixed(6);
        document.getElementById("bsg-gamma").textContent = data.gamma.toFixed(6);
        document.getElementById("bsg-vega").textContent = data.vega.toFixed(6);
        document.getElementById("bsg-theta").textContent = data.theta.toFixed(6);
        document.getElementById("bsg-rho").textContent = data.rho.toFixed(6);

        document.getElementById("bs-greeks-res").style.display = "grid";
        document.getElementById("bs-greeks-chart-wrap").style.display = "block";
        drawBSGreeksChart(data);
        publishDashShared("greeks", { source: "bs-greeks", input: bsPayload("bsg"), result: data });
        if (typeof logRun === "function") {
            logRun("BS Greeks", data.ticker, data.market, { delta: data.delta, gamma: data.gamma });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Greeks complete");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

function drawBSGreeksChart(data) {
    const ctx = document.getElementById("bsGreeksChart").getContext("2d");
    if (bsGreeksChart) bsGreeksChart.destroy();

    bsGreeksChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Delta", "Gamma", "Vega", "Theta", "Rho"],
            datasets: [{
                data: [data.delta, data.gamma, data.vega, data.theta, data.rho],
                backgroundColor: [
                    "rgba(0,108,228,0.9)",
                    "rgba(0,188,122,0.9)",
                    "rgba(218,160,0,0.9)",
                    "rgba(214,54,88,0.9)",
                    "rgba(124,72,224,0.9)",
                ],
                borderColor: [
                    "rgba(54,188,255,1)",
                    "rgba(72,236,162,1)",
                    "rgba(255,206,76,1)",
                    "rgba(255,98,132,1)",
                    "rgba(178,126,255,1)",
                ],
                borderWidth: 1.4,
            }],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#8b9bb5" } },
                y: { ticks: { color: "#8b9bb5" } },
            },
        },
    });
}

async function runBSIV() {
    const empty = document.getElementById("bs-iv-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("IV Solver", 1900, "Solving implied volatility");

    const payload = {
        ticker: document.getElementById("iv-ticker").value,
        market: document.getElementById("iv-market-name").value,
        S: parseFloat(document.getElementById("iv-s").value),
        K: parseFloat(document.getElementById("iv-k").value),
        T: parseFloat(document.getElementById("iv-t").value),
        r: parseFloat(document.getElementById("iv-r").value),
        market_price: parseFloat(document.getElementById("iv-market").value),
        option_type: document.getElementById("iv-type").value,
    };

    try {
        const data = await postJSON(`${BS_BASE}/iv`, payload);
        document.getElementById("iv-sigma").textContent = data.implied_vol.toFixed(6);
        document.getElementById("iv-model").textContent = data.model_price.toFixed(6);
        document.getElementById("iv-error").textContent = data.abs_error.toExponential(3);
        document.getElementById("iv-iter").textContent = String(data.iterations);
        document.getElementById("bs-iv-res").style.display = "grid";
        if (typeof logRun === "function") {
            logRun("BS IV", data.ticker, data.market, { implied_vol: data.implied_vol, iterations: data.iterations });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "IV solved");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

console.log("Black-Scholes module loaded.");
