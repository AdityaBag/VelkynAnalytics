const LIVE_BASE = `${window.__VELKYN_API_ORIGIN}/live/live`;

let lmChart = null;
let lmPollTimer = null;
let lmAgeTimer = null;
let lmLastTick = null;
let lmActive = false;

const LM_MARKET_CAP = {
   NVDA: "$2.15T",
   AAPL: "$2.93T",
   TSLA: "$0.77T",
   MSFT: "$3.08T",
   AMZN: "$2.06T",
   GOOGL: "$2.18T",
   META: "$1.42T",
   PLTR: "$0.06T",
   AI: "$0.01T",
   UPST: "$0.01T",
   BTCUSDT: "$1.66T",
   ETHUSDT: "$0.39T",
   SOLUSDT: "$0.09T",
   BNBUSDT: "$0.08T",
   XRPUSDT: "$0.13T",
};

function lmPublishShared(payload) {
   window.__qpsDashShared = window.__qpsDashShared || {};
   window.__qpsDashShared.live = { timestamp: Date.now(), ...payload };
   try {
      document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key: "live", ...window.__qpsDashShared.live } }));
   } catch (_) {}
}

function lmSetText(id, text) {
   const el = document.getElementById(id);
   if (el) el.textContent = text;
}

function lmSetFeedStatus(state) {
   const dot = document.getElementById("lm-feed-dot");
   if (!dot) return;
   dot.classList.remove("ok", "warn", "bad");
   if (state === "ok") dot.classList.add("ok");
   else if (state === "warn") dot.classList.add("warn");
   else if (state === "bad") dot.classList.add("bad");
}

function lmMoney(value, digits = 2) {
   const n = Number(value);
   if (!Number.isFinite(n)) return "—";
   return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function lmCompact(value) {
   const n = Number(value);
   if (!Number.isFinite(n)) return "—";
   if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
   if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
   if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
   return n.toFixed(0);
}

function lmGetSelection() {
   const type = document.getElementById("live-type")?.value || "stock";
   const symbol = document.getElementById("live-symbol")?.value || "NVDA";
   const days = Math.max(1, Math.min(7, Number(document.getElementById("live-days")?.value || 1)));
   return { asset_type: type, symbol, days };
}

function lmSetSymbolOptions() {
   const typeEl = document.getElementById("live-type");
   const symbolEl = document.getElementById("live-symbol");
   if (!typeEl || !symbolEl) return;

   const stockSymbols = ["NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "PLTR", "AI", "UPST", "JPM", "BAC"];
   const cryptoSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

   const options = typeEl.value === "crypto" ? cryptoSymbols : stockSymbols;
   const prev = symbolEl.value;
   symbolEl.innerHTML = options.map((s) => `<option value="${s}">${s}</option>`).join("");
   symbolEl.value = options.includes(prev) ? prev : options[0];
}

function lmRenderChart(series) {
   if (typeof Chart === "undefined") return;

   const ctx = document.getElementById("lm-chart")?.getContext("2d");
   if (!ctx) return;

   const values = (Array.isArray(series) ? series : []).map(Number).filter(Number.isFinite);
   if (!values.length) return;

   if (lmChart) {
      lmChart.destroy();
      lmChart = null;
   }

   const clipped = values.slice(-260);
   const labels = clipped.map((_, idx) => idx + 1);

   lmChart = new Chart(ctx, {
      type: "line",
      data: {
         labels,
         datasets: [{
            data: clipped,
            borderColor: "rgba(0,255,136,0.95)",
            backgroundColor: "rgba(0,255,136,0.14)",
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
            x: { ticks: { color: "#86a2bf", maxTicksLimit: 10 } },
            y: { ticks: { color: "#86a2bf", callback: (v) => Number(v).toFixed(2) } },
         },
      },
   });
}

function lmRenderPayload(data) {
   const series = Array.isArray(data?.series) ? data.series : [];
   const ohlc = Array.isArray(data?.ohlc) ? data.ohlc : [];
   const latest = ohlc.length ? ohlc[ohlc.length - 1] : null;

   const price = Number(data?.price);
   const previous = series.length > 1 ? Number(series[series.length - 2]) : price;
   const absChange = Number.isFinite(price) && Number.isFinite(previous) ? (price - previous) : NaN;
   const bid = Number.isFinite(price) ? price * 0.9997 : NaN;
   const ask = Number.isFinite(price) ? price * 1.0003 : NaN;

   lmSetText("lm-price", lmMoney(price, 2));
   lmSetText("lm-change-abs", Number.isFinite(absChange) ? `${absChange >= 0 ? "+" : ""}${lmMoney(absChange, 2)}` : "—");
   lmSetText("lm-change-pct", Number.isFinite(Number(data?.change_pct)) ? `${Number(data.change_pct).toFixed(2)}%` : "—");
   lmSetText("lm-volume", latest ? lmCompact(latest.v) : "—");
   lmSetText("lm-high", latest ? lmMoney(latest.h, 2) : "—");
   lmSetText("lm-low", latest ? lmMoney(latest.l, 2) : "—");
   lmSetText("lm-open", latest ? lmMoney(latest.o, 2) : "—");
   lmSetText("lm-mcap", LM_MARKET_CAP[data?.symbol] || "—");
   lmSetText("lm-bid", lmMoney(bid, 2));
   lmSetText("lm-ask", lmMoney(ask, 2));
   lmSetText("lm-session", `${data?.session_type || "mixed"} • ${data?.session_date || "—"}`);

   const empty = document.getElementById("lm-empty");
   if (empty) empty.style.display = "none";
   const res = document.getElementById("lm-res");
   if (res) res.style.display = "grid";
   const chartWrap = document.getElementById("lm-chart-wrap");
   if (chartWrap) chartWrap.style.display = "block";

   const chartSeries = series.length
      ? series
      : ohlc.map((row) => Number(row?.c)).filter(Number.isFinite);

   if (!chartSeries.length) {
      if (empty) {
         empty.style.display = "block";
         empty.textContent = "No chart points available.";
      }
      return;
   }

   lmRenderChart(chartSeries);
   lmLastTick = Date.now();
   lmSetText("lm-age", "Last tick: 0.0s ago");
   lmSetFeedStatus("ok");
}

async function lmFetchLive() {
   const empty = document.getElementById("lm-empty");
   if (!empty) return;

   const payload = lmGetSelection();
   lmSetFeedStatus("warn");

   try {
      const res = await fetch(`${LIVE_BASE}/quote`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         cache: "no-store",
         body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      lmPublishShared({ source: "live-page", input: payload, result: data });
      lmRenderPayload(data);

      if (typeof logRun === "function") {
         logRun("Live", data.symbol, String(data.asset_type || "").toUpperCase(), {
            price: data.price,
            change_pct: data.change_pct,
         });
      }
   } catch (err) {
      const shared = window.__qpsDashShared?.live?.result;
      if (shared && Array.isArray(shared.series) && shared.series.length) {
         lmRenderPayload(shared);
         empty.style.display = "block";
         empty.textContent = `Live fetch failed; showing latest shared snapshot. ${err.message || ""}`.trim();
         lmSetFeedStatus("warn");
      } else {
         empty.style.display = "block";
         empty.textContent = err.message || "Live feed unavailable.";
         lmSetFeedStatus("bad");
      }
   }
}

function lmStartAuto() {
   if (lmPollTimer) clearInterval(lmPollTimer);
   void lmFetchLive();
   lmPollTimer = setInterval(lmFetchLive, 12000);
}

function lmStopAuto() {
   if (lmPollTimer) {
      clearInterval(lmPollTimer);
      lmPollTimer = null;
   }
}

window.addEventListener("DOMContentLoaded", () => {
   const typeEl = document.getElementById("live-type");
   const symbolEl = document.getElementById("live-symbol");
   const daysEl = document.getElementById("live-days");
   const refreshBtn = document.getElementById("lm-refresh-btn");

   lmSetFeedStatus("warn");

   if (typeEl) {
      lmSetSymbolOptions();
      typeEl.addEventListener("change", () => {
         lmSetSymbolOptions();
         if (lmActive) void lmFetchLive();
      });
   }

   if (symbolEl) {
      symbolEl.addEventListener("change", () => {
         if (lmActive) void lmFetchLive();
      });
   }

   if (daysEl) {
      daysEl.addEventListener("change", () => {
         if (lmActive) void lmFetchLive();
      });
   }

   if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
         void lmFetchLive();
      });
   }

   document.addEventListener("qps:page-activated", (event) => {
      const isLive = event?.detail?.page === "live-market";
      lmActive = Boolean(isLive);

      if (isLive) {
         const shared = window.__qpsDashShared?.live?.result;
         if (shared && Array.isArray(shared.series) && shared.series.length) {
            lmRenderPayload(shared);
         }
         lmStartAuto();
      } else {
         lmStopAuto();
      }
   });

   document.addEventListener("qps:dash-shared-updated", (event) => {
      const detail = event?.detail;
      if (!lmActive) return;
      if (detail?.key !== "live" || !detail?.result) return;
      lmRenderPayload(detail.result);
   });

   if (lmAgeTimer) clearInterval(lmAgeTimer);
   lmAgeTimer = setInterval(() => {
      if (!lmActive || !lmLastTick) return;
      const ageSec = (Date.now() - lmLastTick) / 1000;
      lmSetText("lm-age", `Last tick: ${ageSec.toFixed(1)}s ago`);
   }, 1000);
});

console.log("Live market dedicated module loaded.");
