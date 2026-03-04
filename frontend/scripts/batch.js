const BATCH_BASE = `${window.__VELKYN_API_ORIGIN}/batch/batch`;

function publishDashShared(key, payload) {
   window.__qpsDashShared = window.__qpsDashShared || {};
   window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
   try {
      document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
   } catch (_) {}
}

async function runBatchEngine() {
   const empty = document.getElementById("batch-empty");
   empty.style.display = "none";
   if (window.engineLoader) window.engineLoader.start("Batch Engine", 2200, "Running batch pricing");

   const tickersSelect = document.getElementById("batch-tickers");
   const selected = Array.from(tickersSelect.selectedOptions).map(o => o.value);

   const payload = {
      tickers: selected,
      K: parseFloat(document.getElementById("batch-k").value),
      T: parseFloat(document.getElementById("batch-t").value),
      r: parseFloat(document.getElementById("batch-r").value),
      sigma: parseFloat(document.getElementById("batch-sigma").value),
      option_type: document.getElementById("batch-type").value,
   };

   if (!payload.tickers.length) {
      if (window.engineLoader) window.engineLoader.stop(false);
      empty.style.display = "block";
      empty.textContent = "Select at least one stock.";
      return;
   }

   try {
      const res = await fetch(`${BATCH_BASE}/run`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         cache: "no-store",
         body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      publishDashShared("batch", { source: "batch-page", input: payload, result: data });

      renderBatchTable(data.results || []);
      document.getElementById("batch-res").style.display = "block";
      if (typeof logRun === "function") {
         logRun("Batch", selected.join(","), "MIXED", { count: data.count, option_type: payload.option_type });
      }
      if (window.engineLoader) window.engineLoader.stop(true, "Batch complete");
   } catch (err) {
      if (window.engineLoader) window.engineLoader.stop(false);
      empty.style.display = "block";
      empty.textContent = err.message;
   }
}

function renderBatchTable(results) {
   const host = document.getElementById("batch-table-wrap");
   if (!host) return;

   if (!results.length) {
      host.innerHTML = '<div class="emp-t" style="display:block;">No batch results returned.</div>';
      return;
   }

   const rows = results.map(r => `
      <tr>
         <td>${r.ticker}</td>
         <td>${r.market}</td>
         <td>${Number(r.spot).toFixed(2)}</td>
         <td>${Number(r.price).toFixed(6)}</td>
      </tr>
   `).join("");

   host.innerHTML = `
      <table style="width:100%; border-collapse:collapse; color:#cfe7ff;">
         <thead>
            <tr>
               <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Ticker</th>
               <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Market</th>
               <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Spot</th>
               <th style="text-align:left; border-bottom:1px solid rgba(0,180,255,0.25); padding:8px;">Option Price</th>
            </tr>
         </thead>
         <tbody>${rows}</tbody>
      </table>
   `;
}

console.log("Batch engine module loaded.");
