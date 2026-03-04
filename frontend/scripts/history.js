const HISTORY_API_BASE = `${window.__VELKYN_API_ORIGIN}/history/history`;
let historyItemsAll = [];

const MONTH_NAMES = [
   "January", "February", "March", "April", "May", "June",
   "July", "August", "September", "October", "November", "December"
];

function publishDashShared(key, payload) {
   window.__qpsDashShared = window.__qpsDashShared || {};
   window.__qpsDashShared[key] = { timestamp: Date.now(), ...payload };
   try {
      document.dispatchEvent(new CustomEvent("qps:dash-shared-updated", { detail: { key, ...window.__qpsDashShared[key] } }));
   } catch (_) {}
}

async function loadHistory() {
   const empty = document.getElementById("history-empty");
   empty.style.display = "none";
   if (window.engineLoader) window.engineLoader.start("History", 1200, "Loading run history");

   try {
      const res = await fetch(`${HISTORY_API_BASE}/runs?limit=200`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      publishDashShared("history", { source: "history-page", result: data });

      historyItemsAll = Array.isArray(data?.items) ? data.items : [];
      setupHistoryFilters(historyItemsAll);
      applyHistoryFilters();
      document.getElementById("history-wrap").style.display = "block";
      if (window.engineLoader) window.engineLoader.stop(true, "History loaded");
   } catch (err) {
      if (window.engineLoader) window.engineLoader.stop(false);
      empty.style.display = "block";
      empty.textContent = err.message;
   }
}

async function clearHistory() {
   try {
      if (window.engineLoader) window.engineLoader.start("History", 1200, "Clearing run history");
      const res = await fetch(`${HISTORY_API_BASE}/runs`, { method: "DELETE" });
      if (!res.ok) {
         const payload = await res.json().catch(() => ({}));
         throw new Error(payload?.detail || `Clear failed (${res.status})`);
      }
      historyItemsAll = [];
      setupHistoryFilters(historyItemsAll);
      renderHistoryRows([]);
      loadHistory();
   } catch (err) {
      if (window.engineLoader) window.engineLoader.stop(false);
      const empty = document.getElementById("history-empty");
      if (empty) {
         empty.style.display = "block";
         empty.textContent = err?.message || "Failed to clear history.";
      }
   }
}

function parseRunDate(ts) {
   const d = ts ? new Date(ts) : null;
   return d && !Number.isNaN(d.getTime()) ? d : null;
}

function isoWeekParts(date) {
   const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
   const dayNum = utc.getUTCDay() || 7;
   utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
   const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
   const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
   return { year: utc.getUTCFullYear(), week };
}

function startOfWeek(date) {
   const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
   const day = d.getDay();
   const diff = day === 0 ? -6 : 1 - day;
   d.setDate(d.getDate() + diff);
   d.setHours(0, 0, 0, 0);
   return d;
}

function endOfWeek(date) {
   const s = startOfWeek(date);
   const e = new Date(s);
   e.setDate(s.getDate() + 6);
   e.setHours(23, 59, 59, 999);
   return e;
}

function hhmmToMinutes(value) {
   if (!value || !value.includes(":")) return null;
   const [hh, mm] = value.split(":").map(Number);
   if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
   return hh * 60 + mm;
}

function setHistoryFilterInfo(text) {
   const info = document.getElementById("history-filter-info");
   if (info) info.textContent = text || "";
}

function setupHistoryFilters(items) {
   const now = new Date();
   const curYear = now.getFullYear();
   const curMonth = now.getMonth() + 1;
   const curWeek = isoWeekParts(now);

   const yearSel = document.getElementById("history-year");
   const monthSel = document.getElementById("history-month");
   const weekSel = document.getElementById("history-week");
   const rangeSel = document.getElementById("history-range");

   const years = new Set([curYear]);
   const weekMap = new Map();

   (items || []).forEach((it) => {
      const d = parseRunDate(it?.timestamp);
      if (!d) return;
      years.add(d.getFullYear());
      const w = isoWeekParts(d);
      const key = `${w.year}-W${String(w.week).padStart(2, "0")}`;
      if (!weekMap.has(key)) weekMap.set(key, { key, year: w.year, week: w.week });
   });

   const yearList = Array.from(years).sort((a, b) => b - a);
   if (yearSel) {
      yearSel.innerHTML = yearList.map((y) => `<option value="${y}">${y}</option>`).join("");
      yearSel.value = String(curYear);
   }

   if (monthSel) {
      monthSel.innerHTML = MONTH_NAMES.map((name, idx) => `<option value="${idx + 1}">${name}</option>`).join("");
      monthSel.value = String(curMonth);
   }

   const curWeekKey = `${curWeek.year}-W${String(curWeek.week).padStart(2, "0")}`;
   if (!weekMap.has(curWeekKey)) weekMap.set(curWeekKey, { key: curWeekKey, year: curWeek.year, week: curWeek.week });
   const weekList = Array.from(weekMap.values()).sort((a, b) => (b.year - a.year) || (b.week - a.week));
   if (weekSel) {
      weekSel.innerHTML = weekList
         .map((w) => `<option value="${w.key}">${w.key}</option>`)
         .join("");
      weekSel.value = curWeekKey;
   }

   if (rangeSel && !rangeSel.value) rangeSel.value = "week";

   ["history-range", "history-year", "history-month", "history-week", "history-date", "history-time-from", "history-time-to"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.bound === "1") return;
      el.addEventListener("change", () => applyHistoryFilters());
      el.dataset.bound = "1";
   });
}

function applyHistoryFilters() {
   const range = document.getElementById("history-range")?.value || "week";
   const yearVal = Number(document.getElementById("history-year")?.value);
   const monthVal = Number(document.getElementById("history-month")?.value);
   const weekVal = document.getElementById("history-week")?.value || "";
   const dateVal = document.getElementById("history-date")?.value || "";
   const fromVal = document.getElementById("history-time-from")?.value || "";
   const toVal = document.getElementById("history-time-to")?.value || "";

   const now = new Date();
   let start = null;
   let end = null;

   if (range === "day") {
      const base = dateVal ? new Date(`${dateVal}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
      end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
   } else if (range === "week") {
      if (weekVal && weekVal.includes("-W")) {
         const [yStr, wStr] = weekVal.split("-W");
         const y = Number(yStr);
         const w = Number(wStr);
         if (Number.isFinite(y) && Number.isFinite(w)) {
            const jan4 = new Date(y, 0, 4);
            const jan4WeekStart = startOfWeek(jan4);
            start = new Date(jan4WeekStart);
            start.setDate(jan4WeekStart.getDate() + (w - 1) * 7);
            end = endOfWeek(start);
         }
      }
      if (!start || !end) {
         start = startOfWeek(now);
         end = endOfWeek(now);
      }
   } else if (range === "month") {
      const y = Number.isFinite(yearVal) ? yearVal : now.getFullYear();
      const m = Number.isFinite(monthVal) ? monthVal : (now.getMonth() + 1);
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
   } else if (range === "year") {
      const y = Number.isFinite(yearVal) ? yearVal : now.getFullYear();
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
   }

   let filtered = historyItemsAll.filter((it) => {
      const d = parseRunDate(it?.timestamp);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
   });

   if (dateVal) {
      filtered = filtered.filter((it) => {
         const d = parseRunDate(it?.timestamp);
         if (!d) return false;
         const y = d.getFullYear();
         const m = String(d.getMonth() + 1).padStart(2, "0");
         const day = String(d.getDate()).padStart(2, "0");
         return `${y}-${m}-${day}` === dateVal;
      });
   }

   const fromMin = hhmmToMinutes(fromVal);
   const toMin = hhmmToMinutes(toVal);
   if (fromMin != null || toMin != null) {
      filtered = filtered.filter((it) => {
         const d = parseRunDate(it?.timestamp);
         if (!d) return false;
         const mins = d.getHours() * 60 + d.getMinutes();
         if (fromMin != null && mins < fromMin) return false;
         if (toMin != null && mins > toMin) return false;
         return true;
      });
   }

   const scopeText = range === "all" ? "All logs" : `${range[0].toUpperCase()}${range.slice(1)} view`;
   setHistoryFilterInfo(`${scopeText} · ${filtered.length} shown / ${historyItemsAll.length} total`);
   renderHistoryRows(filtered);
}

function resetHistoryFilters() {
   const now = new Date();
   const week = isoWeekParts(now);
   const weekKey = `${week.year}-W${String(week.week).padStart(2, "0")}`;

   const range = document.getElementById("history-range");
   const year = document.getElementById("history-year");
   const month = document.getElementById("history-month");
   const weekSel = document.getElementById("history-week");
   const date = document.getElementById("history-date");
   const tf = document.getElementById("history-time-from");
   const tt = document.getElementById("history-time-to");

   if (range) range.value = "week";
   if (year) year.value = String(now.getFullYear());
   if (month) month.value = String(now.getMonth() + 1);
   if (weekSel && [...weekSel.options].some((o) => o.value === weekKey)) weekSel.value = weekKey;
   if (date) date.value = "";
   if (tf) tf.value = "";
   if (tt) tt.value = "";

   applyHistoryFilters();
}

function renderHistoryRows(items) {
   const body = document.getElementById("history-body");
   if (!body) return;

   if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" style="padding:10px;">No runs recorded yet.</td></tr>';
      return;
   }

   body.innerHTML = items.map(it => {
      const ts = it.timestamp ? new Date(it.timestamp).toLocaleString() : "-";
      return `
         <tr>
            <td>${ts}</td>
            <td>${it.engine || "-"}</td>
            <td>${it.ticker || "-"}</td>
            <td>${it.market || "-"}</td>
            <td>${JSON.stringify(it.summary || {})}</td>
         </tr>
      `;
   }).join("");
}

window.addEventListener("DOMContentLoaded", () => {
   const clearBtn = document.getElementById("history-clear-btn");
   const host = (window.location.hostname || "").toLowerCase();
   const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
   if (clearBtn && !isLocalHost) {
      clearBtn.disabled = true;
      clearBtn.title = "Clear History is enabled only on local machine host.";
      clearBtn.style.opacity = "0.55";
      clearBtn.style.cursor = "not-allowed";
   }

   loadHistory();
});

console.log("History module loaded.");
