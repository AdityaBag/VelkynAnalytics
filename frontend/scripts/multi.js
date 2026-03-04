const MULTI_RATE_BASE = `${window.__VELKYN_API_ORIGIN}/multi-rate/multi-rate`;
let multiRateChart = null;

function publishDashShared(key, payload) {
   window.__qpsDashShared = window.__qpsDashShared || {};
   window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
   try {
      document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
   } catch (_) {}
}

async function runMultiRateEngine() {
   const empty = document.getElementById("multi-empty");
   empty.style.display = "none";
   if (window.engineLoader) window.engineLoader.start("Multi-Rate", 2000, "Evaluating rate scenarios");

   const rates = document.getElementById("multi-rates").value
      .split(",")
      .map(v => parseFloat(v.trim()))
      .filter(v => Number.isFinite(v));

   const payload = {
      ticker: document.getElementById("multi-ticker").value,
      K: parseFloat(document.getElementById("multi-k").value),
      T: parseFloat(document.getElementById("multi-t").value),
      sigma: parseFloat(document.getElementById("multi-sigma").value),
      option_type: document.getElementById("multi-type").value,
      rates,
   };

   try {
      const res = await fetch(`${MULTI_RATE_BASE}/run`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         cache: "no-store",
         body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      publishDashShared("multi", { source: "multi-rate", input: payload, result: data });

      document.getElementById("multi-spot").textContent = Number(data.spot).toFixed(2);
      document.getElementById("multi-count").textContent = String((data.series || []).length);
      document.getElementById("multi-res").style.display = "grid";
      document.getElementById("multi-chart-wrap").style.display = "block";
      drawMultiRateChart(data.series || []);

      if (typeof logRun === "function") {
         logRun("Multi-Rate", payload.ticker, document.getElementById("multi-market").value, {
            rates: rates.length,
            option_type: payload.option_type,
         });
      }
      if (window.engineLoader) window.engineLoader.stop(true, "Multi-rate complete");
   } catch (err) {
      if (window.engineLoader) window.engineLoader.stop(false);
      empty.style.display = "block";
      empty.textContent = err.message;
   }
}

function drawMultiRateChart(series) {
   const ctx = document.getElementById("multiChart").getContext("2d");
   if (multiRateChart) multiRateChart.destroy();

   multiRateChart = new Chart(ctx, {
      type: "line",
      data: {
         labels: series.map(s => `${(s.rate * 100).toFixed(2)}%`),
         datasets: [{
            label: "Option Price",
            data: series.map(s => s.price),
            borderColor: "rgba(34,197,94,0.95)",
            backgroundColor: "rgba(34,197,94,0.18)",
            borderWidth: 2.3,
            pointRadius: 3.2,
            pointBackgroundColor: "rgba(34,197,94,0.95)",
            fill: true,
         }],
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

console.log("Multi-rate module loaded.");
