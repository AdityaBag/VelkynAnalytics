const SCENARIO_BASE = `${window.__VELKYN_API_ORIGIN}/scenario/scenario`;
let scenarioChart = null;

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeScenarioRow(row = {}) {
    return {
        spot_shock: toFiniteNumber(row.spot_shock ?? row.spotShock ?? row.delta_s ?? row.spot_delta, 0),
        vol_shock: toFiniteNumber(row.vol_shock ?? row.volShock ?? row.delta_sigma ?? row.vol_delta, 0),
        price: toFiniteNumber(row.price ?? row.px ?? row.option_price ?? row.value, 0),
    };
}

function extractScenarioRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    if (Array.isArray(payload.scenarios)) return payload.scenarios;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.output && Array.isArray(payload.output.scenarios)) return payload.output.scenarios;

    return [];
}

function publishDashShared(key, payload) {
    window.__qpsDashShared = window.__qpsDashShared || {};
    window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
    try {
        document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
    } catch (_) {}
}

async function runScenarioEngine() {
    const empty = document.getElementById("scenario-empty");
    empty.style.display = "none";
    if (window.engineLoader) window.engineLoader.start("Scenario", 2100, "Running stress scenarios");

    const payload = {
        S: parseFloat(document.getElementById("sc-s").value),
        K: parseFloat(document.getElementById("sc-k").value),
        T: parseFloat(document.getElementById("sc-t").value),
        r: parseFloat(document.getElementById("sc-r").value),
        sigma: parseFloat(document.getElementById("sc-sigma").value),
        option_type: document.getElementById("sc-type").value,
        spot_shocks: [-0.1, -0.05, 0, 0.05, 0.1],
        vol_shocks: [-0.2, 0, 0.2],
    };

    try {
        const res = await fetch(`${SCENARIO_BASE}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

        const rows = extractScenarioRows(data).map(normalizeScenarioRow);

        renderScenarioEngineTable(rows);

        const tableWrap = document.getElementById("scenario-table-wrap");
        const chartWrap = document.getElementById("scenario-chart-wrap");
        if (tableWrap) {
            tableWrap.classList.add("active");
            tableWrap.style.display = "";
        }
        if (chartWrap) {
            chartWrap.classList.add("active");
            chartWrap.style.display = "";
        }

        try {
            drawScenarioEngineChart(rows);
        } catch (_) {}

        if (!rows.length) {
            throw new Error("No scenario rows found in response payload.");
        }

        publishDashShared("scenario", { source: "scenario-page", input: payload, result: data });

        if (typeof logRun === "function") {
            logRun("Scenario", document.getElementById("sc-ticker").value, document.getElementById("sc-market").value, {
                base_price: payload.S,
                rows: (data.scenarios || []).length,
            });
        }
        if (window.engineLoader) window.engineLoader.stop(true, "Scenario run complete");
    } catch (err) {
        if (window.engineLoader) window.engineLoader.stop(false);
        empty.style.display = "block";
        empty.textContent = err.message;
    }
}

function renderScenarioEngineTable(rows) {
        const wrap = document.getElementById("scenario-table-wrap");
        if (!wrap) return;

        const bodyRows = rows.length
                ? rows.map((row) => {
                        const r = normalizeScenarioRow(row);
                        return `
                            <tr>
                                <td style="padding:8px; border-bottom:1px solid rgba(0,180,255,0.12);">${(r.spot_shock * 100).toFixed(1)}%</td>
                                <td style="padding:8px; border-bottom:1px solid rgba(0,180,255,0.12);">${(r.vol_shock * 100).toFixed(1)}%</td>
                                <td style="padding:8px; border-bottom:1px solid rgba(0,180,255,0.12);">${r.price.toFixed(6)}</td>
                            </tr>
                        `;
                }).join("")
                : `<tr><td colspan="3" style="padding:10px;color:#9db8d4;">No scenario rows returned.</td></tr>`;

        wrap.innerHTML = `
            <div class="cht-hd">Scenario Table</div>
            <table style="width:100%; border-collapse:collapse; color:#cfe7ff;">
                <thead>
                    <tr>
                        <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Spot Shock</th>
                        <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Vol Shock</th>
                        <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Price</th>
                    </tr>
                </thead>
                <tbody id="scenario-table-body">${bodyRows}</tbody>
            </table>
        `;
}

function drawScenarioEngineChart(rows) {
    if (!Array.isArray(rows) || !rows.length) return;

    const chartEl = document.getElementById("scenarioChart");
    if (!chartEl || typeof chartEl.getContext !== "function") return;
    const ctx = chartEl.getContext("2d");
    if (!ctx) return;

    if (scenarioChart) scenarioChart.destroy();

    const baseRow = rows.find(r => Number(r.spot_shock) === 0 && Number(r.vol_shock) === 0);
    const basePrice = baseRow ? Number(baseRow.price) : (rows.length ? Number(rows[Math.floor(rows.length / 2)].price) : 0);

    scenarioChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: rows.map(r => `S ${Math.round(r.spot_shock * 100)}% | V ${Math.round(r.vol_shock * 100)}%`),
            datasets: [{
                label: "Scenario Price",
                data: rows.map(r => r.price),
                backgroundColor: rows.map(r => Number(r.price) >= basePrice ? "rgba(0, 120, 255, 0.86)" : "rgba(245, 40, 80, 0.86)"),
                borderColor: "rgba(0,0,0,0)",
                borderWidth: 0,
                hoverBackgroundColor: rows.map(r => Number(r.price) >= basePrice ? "rgba(40, 150, 255, 0.94)" : "rgba(255, 70, 105, 0.94)"),
                hoverBorderColor: "rgba(0,0,0,0)",
                hoverBorderWidth: 0,
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

console.log("Scenario module loaded.");
