const DASH_ENDPOINTS = {
   mc: `${window.__VELKYN_API_ORIGIN}/mc/mc/run`,
   bs: `${window.__VELKYN_API_ORIGIN}/bs/bs/pricing`,
   greeks: `${window.__VELKYN_API_ORIGIN}/bs/bs/greeks`,
   bin: `${window.__VELKYN_API_ORIGIN}/binomial/binomial/european`,
   vol: `${window.__VELKYN_API_ORIGIN}/vol/vol/smile`,
   multi: `${window.__VELKYN_API_ORIGIN}/multi-rate/multi-rate/run`,
   scenario: `${window.__VELKYN_API_ORIGIN}/scenario/scenario/run`,
   batch: `${window.__VELKYN_API_ORIGIN}/batch/batch/run`,
   history: `${window.__VELKYN_API_ORIGIN}/history/history/runs?limit=120`,
   live: `${window.__VELKYN_API_ORIGIN}/live/live/quote`,
};

const DASH_LIVE_SYMBOLS = [
   { label: "NVDA — NVIDIA", value: "NVDA", asset_type: "stock" },
   { label: "AAPL — Apple", value: "AAPL", asset_type: "stock" },
   { label: "TSLA — Tesla", value: "TSLA", asset_type: "stock" },
   { label: "MSFT — Microsoft", value: "MSFT", asset_type: "stock" },
   { label: "AMZN — Amazon", value: "AMZN", asset_type: "stock" },
   { label: "GOOGL — Alphabet", value: "GOOGL", asset_type: "stock" },
   { label: "META — Meta", value: "META", asset_type: "stock" },
   { label: "BTCUSDT — Bitcoin", value: "BTCUSDT", asset_type: "crypto" },
   { label: "ETHUSDT — Ethereum", value: "ETHUSDT", asset_type: "crypto" },
];


let dashCompareChart = null;
let dashRateChart = null;
let dashHistoryChart = null;
let dashSmileChart = null;
let dashMcPathsChart = null;
let dashLiveChart = null;
let dashLiveTimer = null;
let dashLiveLastTick = null;
let dashMcSnapshotTs = 0;

const LIVE_MARKET_CAP = {
   NVDA: "$2.15T",
   AAPL: "$2.93T",
   TSLA: "$0.77T",
   MSFT: "$3.08T",
   AMZN: "$2.06T",
   GOOGL: "$2.18T",
   META: "$1.42T",
   BTCUSDT: "$1.66T",
   ETHUSDT: "$0.39T",
};

function dashNum(id, fallback = 0) {
   const value = parseFloat(document.getElementById(id)?.value);
   return Number.isFinite(value) ? value : fallback;
}

function dashFmt(value, digits = 4) {
   return Number(value).toFixed(digits);
}

function dashMoney(value, digits = 2) {
   const numeric = Number(value);
   if (!Number.isFinite(numeric)) return "—";
   return `$${numeric.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function dashCompact(value) {
   const n = Number(value);
   if (!Number.isFinite(n)) return "—";
   if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
   if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
   if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
   return n.toFixed(0);
}

function setText(id, text) {
   const el = document.getElementById(id);
   if (el) el.textContent = text;
}

function getSharedMcSnapshot() {
   if (window.__qpsMcLatest && window.__qpsMcLatest.result) return window.__qpsMcLatest;
   return null;
}

function applySharedMcToDashboard(snapshot) {
   if (!snapshot?.result) return false;
   const mc = snapshot.result;
   const paths = Array.isArray(mc.paths_sample) ? mc.paths_sample : [];

   if (paths.length) {
      drawMcPathsChart(paths, { full: true });
      renderDistBars(mc);
   }

   if (Number.isFinite(Number(mc.price))) {
      setText("dash-kpi-avg", dashFmt(mc.price, 4));
      setText("dash-kpi-avg-sub", "MC shared from Monte Carlo page");
   }

   dashMcSnapshotTs = Number(snapshot.timestamp || Date.now());
   return true;
}

function refreshDashboardMcFromShared() {
   const dashboardPage = document.getElementById("dashboard");
   if (!dashboardPage?.classList.contains("active")) return false;
   const snapshot = getSharedMcSnapshot();
   if (!snapshot?.result) return false;
   return applySharedMcToDashboard(snapshot);
}

function getDashShared(key) {
   return window.__qpsDashShared?.[key] || null;
}

function getSharedPriceFromDedicated() {
   const mcPrice = Number(getSharedMcSnapshot()?.result?.price);
   const bsPrice = Number(getDashShared("bs")?.result?.selected_price);
   const binPrice = Number(getDashShared("bin")?.result?.price);

   const hasMc = Number.isFinite(mcPrice);
   const hasBs = Number.isFinite(bsPrice);
   const hasBin = Number.isFinite(binPrice);
   if (!hasMc && !hasBs && !hasBin) return null;

   return {
      mc: hasMc ? mcPrice : null,
      bs: hasBs ? bsPrice : null,
      bin: hasBin ? binPrice : null,
   };
}

function refreshCompareFromSharedPrices() {
   const shared = getSharedPriceFromDedicated();
   if (!shared) return;

   const mc = Number.isFinite(shared.mc) ? shared.mc : 0;
   const bs = Number.isFinite(shared.bs) ? shared.bs : 0;
   const bin = Number.isFinite(shared.bin) ? shared.bin : 0;
   const count = [shared.mc, shared.bs, shared.bin].filter((v) => Number.isFinite(v)).length;
   const avg = count ? (mc + bs + bin) / count : 0;

   setText("dash-kpi-avg", dashFmt(avg, 4));
   setText("dash-kpi-avg-sub", `MC ${Number.isFinite(shared.mc) ? dashFmt(shared.mc, 2) : "—"} · BS ${Number.isFinite(shared.bs) ? dashFmt(shared.bs, 2) : "—"} · BIN ${Number.isFinite(shared.bin) ? dashFmt(shared.bin, 2) : "—"}`);
   drawCompareChart([mc, bs, bin]);
}

function applyDashSharedUpdate(detail) {
   if (!detail?.key || !detail?.result) return;

   if (detail.key === "bs") {
      const bs = detail.result;
      setText("dash-bs-selected", dashMoney(bs.selected_price, 2));
      setText("dash-bs-call", dashMoney(bs.call_price, 2));
      setText("dash-bs-put", dashMoney(bs.put_price, 2));
      setText("dash-bs-d1d2", `d1=${dashFmt(bs.d1, 2)} d2=${dashFmt(bs.d2, 2)}`);
      refreshCompareFromSharedPrices();
   }

   if (detail.key === "greeks") {
      const greeks = detail.result;
      setText("dash-kpi-delta", dashFmt(greeks.delta, 4));
      setText("dash-kpi-delta-sub", `Γ ${dashFmt(greeks.gamma, 4)} · Vega ${dashFmt(greeks.vega, 4)}`);
      renderBsEnginePanel(
         getDashShared("bs")?.result || { selected_price: 0, call_price: 0, put_price: 0, d1: 0, d2: 0 },
         greeks,
         {
            S: dashNum("dash-s", 120),
            K: dashNum("dash-k", 120),
            T: dashNum("dash-t", 1),
            r: dashNum("dash-r", 0.05),
            sigma: dashNum("dash-sigma", 0.25),
         }
      );
   }

   if (detail.key === "bin") {
      refreshCompareFromSharedPrices();
   }

   if (detail.key === "vol") {
      if (detail.result?.strikes?.length && detail.result?.implied_vol?.length) {
         drawSmileChart(detail.result.strikes, detail.result.implied_vol);
         const mid = detail.result.implied_vol[Math.floor(detail.result.implied_vol.length / 2)] || 0;
         setText("dash-kpi-iv", `${(mid * 100).toFixed(2)}%`);
      }
   }

   if (detail.key === "multi") {
      if (detail.result?.series?.length) {
         drawRateChart(detail.result.series);
      }
   }

   if (detail.key === "scenario") {
      if (detail.result?.scenarios?.length) {
         renderScenarioTable(detail.result.scenarios);
         setText("dash-kpi-scen", String(detail.result.scenarios.length));
      }
   }

   if (detail.key === "batch") {
      const count = Number(detail.result?.count);
      if (Number.isFinite(count)) {
         setText("dash-kpi-batch", String(count));
         setText("dash-kpi-batch-sub", `${(detail.result?.option_type || "CALL").toUpperCase()} batch`);
      }
   }

   if (detail.key === "history") {
      const items = detail.result?.items || [];
      setText("dash-kpi-runs", String(items.length));
      setText("dash-kpi-runs-sub", "latest history window");
      drawHistoryChart(items);
      renderActivity(items);
   }

   if (detail.key === "live") {
      const data = detail.result;
      const series = Array.isArray(data?.series) ? data.series : [];
      const ohlc = Array.isArray(data?.ohlc) ? data.ohlc : [];
      const latest = ohlc.length ? ohlc[ohlc.length - 1] : null;
      const previous = series.length > 1 ? Number(series[series.length - 2]) : Number(data.price);
      const absChange = Number(data.price) - previous;
      const bid = Number(data.price) * 0.9997;
      const ask = Number(data.price) * 1.0003;
      const symbol = data?.symbol || "NVDA";

      setText("dash-live-price", dashMoney(data.price, 2));
      setText("dash-live-change-abs", `${absChange >= 0 ? "+" : ""}${dashMoney(absChange, 2)}`);
      setText("dash-live-change", `${Number(data.change_pct).toFixed(2)}%`);
      setText("dash-live-high", latest ? dashMoney(latest.h, 2) : "—");
      setText("dash-live-low", latest ? dashMoney(latest.l, 2) : "—");
      setText("dash-live-open", latest ? dashMoney(latest.o, 2) : "—");
      setText("dash-live-volume", latest ? dashCompact(latest.v) : "—");
      setText("dash-live-mcap", LIVE_MARKET_CAP[symbol] || "—");
      setText("dash-live-bid", dashMoney(bid, 2));
      setText("dash-live-ask", dashMoney(ask, 2));
      dashLiveLastTick = Date.now();
      setText("dash-live-age", "Last tick: 0.0s ago");
      drawLiveChart(series.slice(-180));
   }
}

function refreshDashboardAllFromShared() {
   const dashboardPage = document.getElementById("dashboard");
   if (!dashboardPage?.classList.contains("active")) return;

   refreshDashboardMcFromShared();

   ["bs", "greeks", "bin", "vol", "multi", "scenario", "batch", "history", "live"].forEach((key) => {
      const snapshot = getDashShared(key);
      if (snapshot?.result) {
         applyDashSharedUpdate({ key, ...snapshot });
      }
   });
}

function setupDashboardControls() {
   if (typeof initSingleStockSelector === "function") {
      initSingleStockSelector("dash-ticker", "dash-market", null);
   }

   const marketEl = document.getElementById("dash-market");
   if (marketEl && !marketEl.value) {
      marketEl.value = "NASDAQ";
   }
}

function setDashMessage(msg) {
   const el = document.getElementById("dash-empty");
   if (!el) return;
   el.style.display = "block";
   el.textContent = msg;
}

function setDashboardLoadingState(active) {
   const page = document.querySelector("#dashboard .dashx-page");
   if (!page) return;
   page.classList.toggle("dashx-loading", !!active);
}

function hideDashMessage() {
   const el = document.getElementById("dash-empty");
   if (!el) return;
   el.style.display = "none";
}

async function dashPost(url, payload) {
   const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
   });
   const data = await res.json();
   if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);
   return data;
}

async function dashGet(url) {
   const res = await fetch(url, { cache: "no-store" });
   const data = await res.json();
   if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);
   return data;
}

function createLineChart(ctx, labels, data, borderColor, fillColor, yFormatter = null) {
   return new Chart(ctx, {
      type: "line",
      data: {
         labels,
         datasets: [{
            data,
            borderColor,
            backgroundColor: fillColor,
            borderWidth: 2,
            pointRadius: 1.5,
            tension: 0.22,
            fill: true,
         }],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
            x: { ticks: { color: "#86a2bf" } },
            y: { ticks: { color: "#86a2bf", callback: yFormatter || ((v) => Number(v).toFixed(2)) } },
         },
      },
   });
}

function drawCompareChart(values) {
   const ctx = document.getElementById("dashCompareChart")?.getContext("2d");
   if (!ctx) return;
   if (dashCompareChart) dashCompareChart.destroy();

   dashCompareChart = new Chart(ctx, {
      type: "bar",
      data: {
         labels: ["Monte Carlo", "Black-Scholes", "Binomial"],
         datasets: [{
            data: values,
            backgroundColor: ["rgba(0,190,255,0.72)", "rgba(130,90,255,0.72)", "rgba(255,170,36,0.72)"],
            borderColor: "rgba(200,230,255,0.85)",
            borderWidth: 1,
            maxBarThickness: 36,
         }],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
            x: { ticks: { color: "#86a2bf" } },
            y: { ticks: { color: "#86a2bf", callback: (v) => Number(v).toFixed(2) } },
         },
      },
   });
}

function drawRateChart(series) {
   const ctx = document.getElementById("dashRateChart")?.getContext("2d");
   if (!ctx) return;
   if (dashRateChart) dashRateChart.destroy();

   const labels = (series || []).map((s) => `${(Number(s.rate) * 100).toFixed(2)}%`);
   const values = (series || []).map((s) => Number(s.price));
   dashRateChart = createLineChart(ctx, labels, values, "rgba(0,255,136,0.95)", "rgba(0,255,136,0.16)");
}

function drawHistoryChart(items) {
   const ctx = document.getElementById("dashHistoryChart")?.getContext("2d");
   if (!ctx) return;
   if (dashHistoryChart) dashHistoryChart.destroy();

   const tally = {};
   (items || []).forEach((it) => {
      const key = it.engine || "Unknown";
      tally[key] = (tally[key] || 0) + 1;
   });

   dashHistoryChart = new Chart(ctx, {
      type: "bar",
      data: {
         labels: Object.keys(tally),
         datasets: [{
            data: Object.values(tally),
            backgroundColor: "rgba(0,190,255,0.58)",
            borderColor: "rgba(180,220,255,0.9)",
            borderWidth: 1,
         }],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
            x: { ticks: { color: "#86a2bf" } },
            y: { ticks: { color: "#86a2bf", precision: 0 } },
         },
      },
   });
}

function drawSmileChart(strikes, impliedVol) {
   const ctx = document.getElementById("dashSmileChart")?.getContext("2d");
   if (!ctx) return;
   if (dashSmileChart) dashSmileChart.destroy();

   const labels = (strikes || []).map((v) => Number(v).toFixed(0));
   const values = (impliedVol || []).map((v) => Number(v) * 100);
   dashSmileChart = createLineChart(
      ctx,
      labels,
      values,
      "rgba(255,170,36,0.95)",
      "rgba(255,170,36,0.18)",
      (v) => `${Number(v).toFixed(1)}%`
   );
}

function drawMcPathsChart(paths, options = {}) {
   const ctx = document.getElementById("dashMcPathsChart")?.getContext("2d");
   if (!ctx) return;
   if (dashMcPathsChart) dashMcPathsChart.destroy();

   const { full = false } = options;
   const source = Array.isArray(paths) ? paths : [];

   const toFinitePath = (path) => (Array.isArray(path) ? path.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : []);
   const cleanPaths = source.map(toFinitePath).filter((p) => p.length > 1);
   if (!cleanPaths.length) return;

   const maxSeries = full ? 320 : 8;
   const maxSteps = full ? 300 : 260;

   const pickEvenly = (arr, limit) => {
      if (arr.length <= limit) return arr;
      return Array.from({ length: limit }, (_, i) => {
         const idx = Math.floor((i * (arr.length - 1)) / Math.max(1, limit - 1));
         return arr[idx];
      });
   };

   const compressPath = (path, limit) => {
      if (path.length <= limit) return path;
      return Array.from({ length: limit }, (_, i) => {
         const idx = Math.floor((i * (path.length - 1)) / Math.max(1, limit - 1));
         return path[idx];
      });
   };

   const sample = pickEvenly(cleanPaths, maxSeries).map((p) => compressPath(p, maxSteps));
   const maxLen = sample.length ? Math.max(...sample.map((p) => p.length || 0)) : 0;
   const labels = Array.from({ length: maxLen }, (_, i) => i + 1);
   const colorForPath = (index, total) => {
      const ratio = (index % Math.max(total, 1)) / Math.max(total, 1);
      const angle = ratio * Math.PI * 2;
      const r = Math.round(127 * (Math.sin(angle) + 1));
      const g = Math.round(127 * (Math.sin(angle + (2 * Math.PI / 3)) + 1));
      const b = Math.round(127 * (Math.sin(angle + (4 * Math.PI / 3)) + 1));
      return `rgba(${r}, ${g}, ${b}, 0.98)`;
   };

   dashMcPathsChart = new Chart(ctx, {
      type: "line",
      data: {
         labels,
         datasets: sample.map((path, idx) => ({
            data: path,
            borderColor: colorForPath(idx, sample.length),
            borderWidth: full ? 1.2 : 1.5,
            pointRadius: 0,
            tension: 0,
         })),
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
            x: { ticks: { color: "#86a2bf", maxTicksLimit: 10 } },
            y: { ticks: { color: "#86a2bf", callback: (v) => Number(v).toFixed(2) } },
         },
      },
   });
}

function drawLiveChart(series) {
   const ctx = document.getElementById("dashLiveChart")?.getContext("2d");
   if (!ctx) return;
   if (dashLiveChart) dashLiveChart.destroy();

   const values = (series || []).map((v) => Number(v)).filter((v) => Number.isFinite(v));
   if (!values.length) return;

   const labels = values.map((_, i) => i + 1);
   dashLiveChart = createLineChart(ctx, labels, values, "rgba(0,255,136,0.95)", "rgba(0,255,136,0.14)");
}

function renderDistBars(mcResult) {
   const wrap = document.getElementById("dashDistBars");
   if (!wrap) return;

   const terminalValues = Array.isArray(mcResult?.terminal)
      ? mcResult.terminal
      : (mcResult?.terminal_stats?.S_T || []);
   const values = terminalValues.map((v) => Number(v)).filter((v) => Number.isFinite(v));
   wrap.innerHTML = "";
   if (!values.length) return;

   const bins = 28;
   const min = Math.min(...values);
   const max = Math.max(...values);
   const width = Math.max(1e-9, max - min);
   const counts = Array.from({ length: bins }, () => 0);

   values.forEach((value) => {
      const idx = Math.min(bins - 1, Math.floor(((value - min) / width) * bins));
      counts[idx] += 1;
   });

   const peak = Math.max(...counts, 1);
   counts.forEach((count) => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${Math.max(4, Math.round((count / peak) * 100))}%`;
      wrap.appendChild(bar);
   });
}

function renderBsEnginePanel(bs, greeks, inputs) {
   if (!bs || !greeks) return;

   setText("dash-bs-meta-s", dashFmt(inputs.S, 2));
   setText("dash-bs-meta-k", dashFmt(inputs.K, 2));
   setText("dash-bs-meta-r", `${(inputs.r * 100).toFixed(2)}%`);
   setText("dash-bs-meta-sigma", `${(inputs.sigma * 100).toFixed(2)}%`);
   setText("dash-bs-meta-t", `${dashFmt(inputs.T, 2)}y`);

   setText("dash-bs-selected", dashMoney(bs.selected_price, 2));
   setText("dash-bs-call", dashMoney(bs.call_price, 2));
   setText("dash-bs-put", dashMoney(bs.put_price, 2));
   setText("dash-bs-d1d2", `d1=${dashFmt(bs.d1, 2)} d2=${dashFmt(bs.d2, 2)}`);

   setText("dash-greek-delta", `${greeks.delta >= 0 ? "+" : ""}${dashFmt(greeks.delta, 3)}`);
   setText("dash-greek-gamma", dashFmt(greeks.gamma, 3));
   setText("dash-greek-vega", `${greeks.vega >= 0 ? "+" : ""}${dashFmt(greeks.vega, 3)}`);
   setText("dash-greek-theta", `${greeks.theta >= 0 ? "+" : ""}${dashFmt(greeks.theta, 3)}`);
   setText("dash-greek-rho", `${greeks.rho >= 0 ? "+" : ""}${dashFmt(greeks.rho, 3)}`);

   const deltaExp = Math.min(100, Math.abs(Number(greeks.delta || 0)) * 100);
   const vegaExp = Math.min(100, Math.abs(Number(greeks.vega || 0)) * 100);
   const thetaExp = Math.min(100, Math.abs(Number(greeks.theta || 0)) * 100);
   const rhoExp = Math.min(100, Math.abs(Number(greeks.rho || 0)) * 100);

   const setBar = (id, width) => {
      const el = document.getElementById(id);
      if (el) el.style.width = `${width.toFixed(1)}%`;
   };

   setBar("dash-bs-exp-delta", deltaExp);
   setBar("dash-bs-exp-vega", vegaExp);
   setBar("dash-bs-exp-theta", thetaExp);
   setBar("dash-bs-exp-rho", rhoExp);

   setText("dash-bs-exp-delta-label", `${deltaExp.toFixed(1)}%`);
   setText("dash-bs-exp-vega-label", `${vegaExp.toFixed(1)}%`);
   setText("dash-bs-exp-theta-label", `${thetaExp.toFixed(1)}%`);
   setText("dash-bs-exp-rho-label", `${rhoExp.toFixed(1)}%`);
}

function renderScenarioTable(scenarios) {
   const body = document.getElementById("dashScenarioBody");
   if (!body) return;

   const all = Array.isArray(scenarios) ? scenarios : [];
   const rowByPair = new Map(all.map((row) => [`${Number(row.spot_shock).toFixed(4)}|${Number(row.vol_shock).toFixed(4)}`, row]));
   const model = [
      { name: "Crash", spot: -0.2, vol: 0.15 },
      { name: "Bear", spot: -0.1, vol: 0.08 },
      { name: "Mild dn", spot: -0.05, vol: 0.03 },
      { name: "BASE", spot: 0, vol: 0 },
      { name: "Rally", spot: 0.05, vol: -0.02 },
      { name: "Bull", spot: 0.1, vol: -0.04 },
      { name: "Melt-up", spot: 0.2, vol: -0.06 },
      { name: "Vol spike", spot: 0, vol: 0.2 },
      { name: "Vol crush", spot: 0, vol: -0.1 },
   ];

   const pick = (spot, vol) => rowByPair.get(`${Number(spot).toFixed(4)}|${Number(vol).toFixed(4)}`);
   const selected = model
      .map((entry) => ({ ...entry, row: pick(entry.spot, entry.vol) }))
      .filter((entry) => entry.row);

   const base = selected.find((entry) => entry.name === "BASE")?.row?.price;

   const pill = (v) => {
      const val = Number(v);
      const cls = val > 0 ? "pos" : (val < 0 ? "neg" : "neu");
      const txt = `${val > 0 ? "+" : ""}${(val * 100).toFixed(0)}%`;
      return `<span class="dashx-pill ${cls}">${txt}</span>`;
   };

   body.innerHTML = selected.map((entry) => {
      const price = Number(entry.row.price);
      const vsBase = Number.isFinite(base) ? price - Number(base) : 0;
      const vsTxt = Number.isFinite(base) ? `${vsBase >= 0 ? "+" : ""}${dashMoney(vsBase, 2)}` : "—";
      const vsCls = vsBase > 0 ? "upv" : (vsBase < 0 ? "dnv" : "");
      const rowCls = entry.name === "BASE" ? "base" : "";
      return `<tr class="${rowCls}"><td>${entry.name}</td><td>${pill(entry.spot)}</td><td>${pill(entry.vol)}</td><td>${dashMoney(price, 2)}</td><td class="${vsCls}">${vsTxt}</td></tr>`;
   }).join("");

   if (selected.length) {
      const prices = selected.map((entry) => Number(entry.row.price));
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const baseVal = Number.isFinite(base) ? Number(base) : (min + max) / 2;
      const pct = max > min ? ((baseVal - min) / (max - min)) * 100 : 50;

      setText("dashScenarioMin", dashMoney(min, 2));
      setText("dashScenarioBase", dashMoney(baseVal, 2));
      setText("dashScenarioMax", dashMoney(max, 2));

      const marker = document.getElementById("dashScenarioMarker");
      if (marker) marker.style.left = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
   }
}

function renderActivity(items) {
   const wrap = document.getElementById("dashActivityFeed");
   if (!wrap) return;

   const list = (items || []).slice(0, 7);
   if (!list.length) {
      wrap.innerHTML = `<div class="dashx-feed-item"><div class="name">No recent activity</div><div class="meta">Run Start All to generate snapshots.</div></div>`;
      return;
   }

   wrap.innerHTML = list
      .map((item) => `<div class="dashx-feed-item"><div class="name">${item.engine || "Engine"} · ${item.ticker || "N/A"}</div><div class="meta">${item.timestamp || "—"}</div></div>`)
      .join("");
}

function buildSmileFallback(strikeCenter, baseVol) {
   const center = Number.isFinite(strikeCenter) ? strikeCenter : 120;
   const vol = Number.isFinite(baseVol) ? baseVol : 0.25;
   const strikes = Array.from({ length: 15 }, (_, i) => center * (0.75 + i * 0.0357142857));
   const impliedVol = strikes.map((s) => {
      const m = s / center - 1;
      return Math.max(0.05, vol * (1 + 0.9 * m * m));
   });
   return { strikes, impliedVol };
}

function buildMcFallback(spot, rate, sigma, maturity, pathsCount = 8, steps = 60) {
   const S0 = Number.isFinite(spot) ? spot : 100;
   const r = Number.isFinite(rate) ? rate : 0.05;
   const vol = Number.isFinite(sigma) ? sigma : 0.25;
   const T = Number.isFinite(maturity) ? maturity : 1;
   const dt = T / steps;
   const out = [];

   for (let p = 0; p < pathsCount; p += 1) {
      let prev = S0;
      const path = [];
      for (let t = 0; t < steps; t += 1) {
         const wave = Math.sin((t + 1) * 0.19 + p * 0.63);
         const drift = (r - 0.5 * vol * vol) * dt;
         const diffusion = vol * Math.sqrt(dt) * (wave * 0.75);
         prev = prev * Math.exp(drift + diffusion);
         path.push(prev);
      }
      out.push(path);
   }
   return out;
}

function getLiveSelection() {
   const sel = document.getElementById("dash-live-symbol");
   if (!sel) return DASH_LIVE_SYMBOLS[0];
   return DASH_LIVE_SYMBOLS.find((item) => item.value === sel.value) || DASH_LIVE_SYMBOLS[0];
}

async function refreshDashboardLive() {
   const selected = getLiveSelection();
   try {
      const data = await dashPost(DASH_ENDPOINTS.live, {
         asset_type: selected.asset_type,
         symbol: selected.value,
         days: 1,
      });

      const series = Array.isArray(data.series) ? data.series : [];
      const ohlc = Array.isArray(data.ohlc) ? data.ohlc : [];
      const latest = ohlc.length ? ohlc[ohlc.length - 1] : null;
      const previous = series.length > 1 ? Number(series[series.length - 2]) : Number(data.price);
      const absChange = Number(data.price) - previous;
      const bid = Number(data.price) * 0.9997;
      const ask = Number(data.price) * 1.0003;
      dashLiveLastTick = Date.now();

      setText("dash-live-price", dashMoney(data.price, 2));
      setText("dash-live-change-abs", `${absChange >= 0 ? "+" : ""}${dashMoney(absChange, 2)}`);
      setText("dash-live-change", `${Number(data.change_pct).toFixed(2)}%`);
      setText("dash-live-high", latest ? dashMoney(latest.h, 2) : "—");
      setText("dash-live-low", latest ? dashMoney(latest.l, 2) : "—");
      setText("dash-live-open", latest ? dashMoney(latest.o, 2) : "—");
      setText("dash-live-volume", latest ? dashCompact(latest.v) : "—");
      setText("dash-live-mcap", LIVE_MARKET_CAP[selected.value] || "—");
      setText("dash-live-bid", dashMoney(bid, 2));
      setText("dash-live-ask", dashMoney(ask, 2));
      setText("dash-live-age", "Last tick: 0.0s ago");
      drawLiveChart(series.slice(-180));

      return data;
   } catch {
      setText("dash-live-price", "—");
      setText("dash-live-change-abs", "—");
      setText("dash-live-change", "—");
      setText("dash-live-high", "—");
      setText("dash-live-low", "—");
      setText("dash-live-open", "—");
      setText("dash-live-volume", "—");
      setText("dash-live-mcap", "—");
      setText("dash-live-bid", "—");
      setText("dash-live-ask", "—");
      setText("dash-live-age", "Last tick: —");
      return null;
   }
}

function setupDashboardLiveTicker() {
   const select = document.getElementById("dash-live-symbol");
   if (!select) return;

   select.innerHTML = DASH_LIVE_SYMBOLS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("");
   select.value = "NVDA";
   select.addEventListener("change", () => { void refreshDashboardLive(); });

   if (dashLiveTimer) clearInterval(dashLiveTimer);
   dashLiveTimer = setInterval(() => { void refreshDashboardLive(); }, 12000);
   setInterval(() => {
      if (!dashLiveLastTick) return;
      const ageSec = (Date.now() - dashLiveLastTick) / 1000;
      setText("dash-live-age", `Last tick: ${ageSec.toFixed(1)}s ago`);
   }, 1000);
   void refreshDashboardLive();
}

function setupDashboardClock() {
   const el = document.getElementById("dash-clock");
   if (!el) return;
   const tick = () => {
      const now = new Date();
      el.textContent = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString("en-GB")}`;
   };
   tick();
   setInterval(tick, 1000);
}

async function runDashboardAll() {
   hideDashMessage();
   setDashboardLoadingState(true);
   if (window.engineLoader) {
      window.engineLoader.start("Dashboard Start All", 2200, "Executing all engine snapshots");
   }

   const ticker = document.getElementById("dash-ticker")?.value || "NVDA";
   const market = document.getElementById("dash-market")?.value || "NASDAQ";
   const stock = typeof findStock === "function" ? findStock(ticker) : null;
   const S = stock?.spot ?? 100;

   const K = dashNum("dash-k", 120);
   const T = dashNum("dash-t", 1);
   const r = dashNum("dash-r", 0.05);
   const sigma = dashNum("dash-sigma", 0.25);
   const option_type = "call";

   const sharedMc = getSharedMcSnapshot();
   const sharedBs = getDashShared("bs");
   const sharedGreeks = getDashShared("greeks");
   const sharedBin = getDashShared("bin");
   const sharedVol = getDashShared("vol");
   const sharedMulti = getDashShared("multi");
   const sharedScenario = getDashShared("scenario");
   const sharedBatch = getDashShared("batch");
   const sharedHistory = getDashShared("history");
   const sharedLive = getDashShared("live");

   const tasks = {
      mc: () => {
         if (sharedMc?.result?.paths_sample?.length) {
            return Promise.resolve(sharedMc.result);
         }
         return dashPost(DASH_ENDPOINTS.mc, {
            ticker,
            market,
            S0: S,
            K,
            r,
            sigma,
            T,
            M: 2000,
            n: 180,
            option_type,
            method: "basic",
            days: Math.round(T * 252),
            sample_paths: 12,
         });
      },
      bs: () => sharedBs?.result ? Promise.resolve(sharedBs.result) : dashPost(DASH_ENDPOINTS.bs, { ticker, market, S, K, T, r, sigma, option_type }),
      greeks: () => sharedGreeks?.result ? Promise.resolve(sharedGreeks.result) : dashPost(DASH_ENDPOINTS.greeks, { ticker, market, S, K, T, r, sigma, option_type }),
      bin: () => sharedBin?.result ? Promise.resolve(sharedBin.result) : dashPost(DASH_ENDPOINTS.bin, { S, K, T, r, sigma, N: 180, option_type }),
      vol: () => sharedVol?.result ? Promise.resolve(sharedVol.result) : dashPost(DASH_ENDPOINTS.vol, { S, T, r, sigma_base: sigma, strike_min: Math.max(1, K * 0.75), strike_max: K * 1.25, n_strikes: 17 }),
      multi: () => sharedMulti?.result ? Promise.resolve(sharedMulti.result) : dashPost(DASH_ENDPOINTS.multi, { ticker, K, T, sigma, option_type, rates: [Math.max(0, r - 0.02), Math.max(0, r - 0.01), r, r + 0.01, r + 0.02] }),
      scenario: () => sharedScenario?.result ? Promise.resolve(sharedScenario.result) : dashPost(DASH_ENDPOINTS.scenario, {
         S, K, T, r, sigma, option_type,
         spot_shocks: [-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2],
         vol_shocks: [0.15, 0.08, 0.03, 0, -0.02, -0.04, -0.06, 0.2, -0.1],
      }),
      batch: () => sharedBatch?.result ? Promise.resolve(sharedBatch.result) : dashPost(DASH_ENDPOINTS.batch, { tickers: Array.from(new Set([ticker, "AAPL", "MSFT", "TSLA"])), K, T, r, sigma, option_type }),
      history: () => sharedHistory?.result ? Promise.resolve(sharedHistory.result) : dashGet(DASH_ENDPOINTS.history),
      live: () => sharedLive?.result ? Promise.resolve(sharedLive.result) : refreshDashboardLive(),
   };

   const keys = Object.keys(tasks);
   const settled = await Promise.allSettled(keys.map((key) => tasks[key]()));
   const resultsMap = {};
   const failures = [];

   settled.forEach((result, idx) => {
      const key = keys[idx];
      if (result.status === "fulfilled" && result.value !== null) resultsMap[key] = result.value;
      else failures.push(key);
   });

   try {
      if (resultsMap.bs && resultsMap.mc && resultsMap.bin) {
         const avg = (resultsMap.bs.selected_price + resultsMap.mc.price + resultsMap.bin.price) / 3;
         setText("dash-kpi-avg", dashFmt(avg, 4));
         setText("dash-kpi-avg-sub", `MC ${dashFmt(resultsMap.mc.price, 2)} · BS ${dashFmt(resultsMap.bs.selected_price, 2)} · BIN ${dashFmt(resultsMap.bin.price, 2)}`);
         drawCompareChart([resultsMap.mc.price, resultsMap.bs.selected_price, resultsMap.bin.price]);
      }

      if (resultsMap.vol?.implied_vol?.length) {
         const mid = resultsMap.vol.implied_vol[Math.floor(resultsMap.vol.implied_vol.length / 2)] || sigma;
         setText("dash-kpi-iv", `${(mid * 100).toFixed(2)}%`);
         drawSmileChart(resultsMap.vol.strikes, resultsMap.vol.implied_vol);
      } else {
         const fallbackSmile = buildSmileFallback(K, sigma);
         setText("dash-kpi-iv", `${(sigma * 100).toFixed(2)}%`);
         drawSmileChart(fallbackSmile.strikes, fallbackSmile.impliedVol);
      }

      if (resultsMap.greeks) {
         setText("dash-kpi-delta", dashFmt(resultsMap.greeks.delta, 4));
         setText("dash-kpi-delta-sub", `Γ ${dashFmt(resultsMap.greeks.gamma, 4)} · Vega ${dashFmt(resultsMap.greeks.vega, 4)}`);
      }

      if (resultsMap.bs && resultsMap.greeks) {
         renderBsEnginePanel(resultsMap.bs, resultsMap.greeks, { S, K, T, r, sigma });
      }

      if (resultsMap.scenario?.scenarios) {
         setText("dash-kpi-scen", "9");
         renderScenarioTable(resultsMap.scenario.scenarios);
      }

      if (resultsMap.batch) {
         setText("dash-kpi-batch", String(resultsMap.batch.count));
         setText("dash-kpi-batch-sub", `${resultsMap.batch.option_type?.toUpperCase() || "CALL"} batch`);
      }

      if (resultsMap.live) {
         applyDashSharedUpdate({ key: "live", result: resultsMap.live });
      }

      if (resultsMap.mc?.paths_sample?.length) {
         drawMcPathsChart(resultsMap.mc.paths_sample, { full: Boolean(sharedMc?.result?.paths_sample?.length) });
         renderDistBars(resultsMap.mc);
         if (sharedMc?.result?.paths_sample?.length) {
            setText("dash-kpi-avg-sub", "MC synced from Monte Carlo page");
         }
      } else {
         drawMcPathsChart(buildMcFallback(S, r, sigma, T));
      }

      if (resultsMap.multi?.series) {
         drawRateChart(resultsMap.multi.series);
      }

      const historyItems = resultsMap.history?.items || [];
      setText("dash-kpi-runs", String(historyItems.length));
      setText("dash-kpi-runs-sub", "latest history window");
      drawHistoryChart(historyItems);
      renderActivity(historyItems);

      if (failures.length) {
         setDashMessage(`Completed with partial failures: ${failures.join(", ")}`);
      } else {
         setDashMessage("All engine snapshots completed successfully.");
      }

      if (window.engineLoader) {
         window.engineLoader.stop(failures.length === 0, failures.length ? "Completed with partial failures" : "Dashboard complete");
      }
   } catch (err) {
      if (window.engineLoader) window.engineLoader.stop(false);
      setDashMessage(err.message || "Dashboard run failed.");
   } finally {
      setDashboardLoadingState(false);
   }
}

window.addEventListener("DOMContentLoaded", () => {
   setupDashboardControls();
   setupDashboardClock();
   setupDashboardLiveTicker();

   document.addEventListener("qps:mc-updated", (event) => {
      const snapshot = event?.detail || getSharedMcSnapshot();
      if (!snapshot?.result) return;
      const nextTs = Number(snapshot.timestamp || Date.now());
      if (nextTs <= dashMcSnapshotTs) return;
      applySharedMcToDashboard(snapshot);
   });

   document.addEventListener("qps:page-activated", (event) => {
      if (event?.detail?.page !== "dashboard") return;
      refreshDashboardAllFromShared();
   });

   refreshDashboardAllFromShared();

   document.addEventListener("qps:dash-shared-updated", (event) => {
      const detail = event?.detail;
      applyDashSharedUpdate(detail);
   });
});

window.runDashboardAll = runDashboardAll;
