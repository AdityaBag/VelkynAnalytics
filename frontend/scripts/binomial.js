const BINOMIAL_BASE = `${window.__VELKYN_API_ORIGIN}/binomial/binomial`;
let binConvChart = null;

function publishDashShared(key, payload) {
    window.__qpsDashShared = window.__qpsDashShared || {};
    window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
    try {
        document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
    } catch (_) {}
}

function binPayload(prefix) {
    return {
        S: parseFloat(document.getElementById(`${prefix}-s`).value),
        K: parseFloat(document.getElementById(`${prefix}-k`).value),
        T: parseFloat(document.getElementById(`${prefix}-t`).value),
        r: parseFloat(document.getElementById(`${prefix}-r`).value),
        sigma: parseFloat(document.getElementById(`${prefix}-sigma`).value),
        N: parseInt(document.getElementById(`${prefix}-n`).value, 10),
        option_type: document.getElementById(`${prefix}-type`).value,
    };
}

async function postBinomial(endpoint, payload) {
    const res = await fetch(`${BINOMIAL_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);
    return data;
}

async function runBinomialEuropean() {
    const empty = document.getElementById("bin-eu-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("Binomial EU", 1700, "Pricing European option");
    try {
        const data = await postBinomial("european", binPayload("beu"));
        publishDashShared("bin", { source: "binomial-european", input: binPayload("beu"), result: data });
        document.getElementById("bin-eu-price").textContent = data.price.toFixed(6);
        document.getElementById("bin-eu-bs").textContent = data.bs_benchmark.toFixed(6);
        document.getElementById("bin-eu-diff").textContent = data.abs_diff.toExponential(3);
        document.getElementById("bin-eu-res").style.display = "grid";
        if (typeof logRun === "function") {
            logRun("Binomial European", document.getElementById("beu-ticker").value, document.getElementById("beu-market").value, { price: data.price, N: data.N });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Binomial EU complete");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

async function runBinomialAmerican() {
    const empty = document.getElementById("bin-am-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("Binomial AM", 1700, "Pricing American option");
    try {
        const data = await postBinomial("american", binPayload("bam"));
        publishDashShared("bin", { source: "binomial-american", input: binPayload("bam"), result: data });
        document.getElementById("bin-am-price").textContent = data.price.toFixed(6);
        document.getElementById("bin-am-res").style.display = "grid";
        if (typeof logRun === "function") {
            logRun("Binomial American", document.getElementById("bam-ticker").value, document.getElementById("bam-market").value, { price: data.price, N: data.N });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Binomial AM complete");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

async function runBinomialConvergence() {
    const empty = document.getElementById("bin-conv-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("Binomial Conv", 2200, "Running convergence sweep");

    const payload = {
        S: parseFloat(document.getElementById("bc-s").value),
        K: parseFloat(document.getElementById("bc-k").value),
        T: parseFloat(document.getElementById("bc-t").value),
        r: parseFloat(document.getElementById("bc-r").value),
        sigma: parseFloat(document.getElementById("bc-sigma").value),
        n_start: parseInt(document.getElementById("bc-start").value, 10),
        n_end: parseInt(document.getElementById("bc-end").value, 10),
        n_step: parseInt(document.getElementById("bc-step").value, 10),
        option_type: document.getElementById("bc-type").value,
    };

    try {
        const data = await postBinomial("convergence", payload);
        document.getElementById("bin-conv-wrap").style.display = "block";
        drawBinConv(data);
        if (typeof logRun === "function") {
            logRun("Binomial Convergence", document.getElementById("bc-ticker").value, document.getElementById("bc-market").value, { points: data.prices.length });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Convergence complete");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

function drawBinConv(data) {
    const ctx = document.getElementById("binConvChart").getContext("2d");
    if (binConvChart) binConvChart.destroy();

    binConvChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.N,
            datasets: [
                {
                    label: "Binomial Price",
                    data: data.prices,
                    borderColor: "rgba(59,130,246,0.95)",
                    borderWidth: 2,
                    pointRadius: 0,
                },
                {
                    label: "BS Benchmark",
                    data: data.N.map(() => data.bs_benchmark),
                    borderColor: "rgba(34,197,94,0.92)",
                    borderWidth: 1,
                    borderDash: [6, 4],
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#8b9bb5" } } },
            scales: {
                x: { ticks: { color: "#8b9bb5" } },
                y: { ticks: { color: "#8b9bb5" } },
            },
        },
    });
}

console.log("Binomial module loaded.");
