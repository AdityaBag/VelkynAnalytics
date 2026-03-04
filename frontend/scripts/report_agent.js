const REPORT_AGENT_API = `${window.__VELKYN_API_ORIGIN}/report-agent/report-agent`;

const REPORT_FILE_TYPES = [".pdf", ".docx", ".txt", ".md"];
let reportStatusMap = {};

function reportSetStatus(text, tone = "idle") {
   const el = document.getElementById("report-status");
   if (!el) return;
   el.textContent = text;
   el.dataset.state = tone;
}

function reportSetSummary(message) {
   const el = document.getElementById("report-training-summary");
   if (!el) return;
   el.textContent = message;
}

function reportGetSelectedType() {
   return document.getElementById("report-type")?.value || "";
}

function reportGetSelectedTrainingType() {
   return document.getElementById("report-training-type")?.value || "";
}

function reportUpdateGenerateState() {
   const btn = document.getElementById("report-generate-btn");
   const type = reportGetSelectedType();
   const status = reportStatusMap[type];
   if (!btn) return;
   btn.disabled = !status?.enabled;
}

function reportPopulateStyles(styles) {
   const sel = document.getElementById("report-style");
   if (!sel) return;
   sel.innerHTML = (styles || [])
      .map((item) => `<option value="${item}">${item}</option>`)
      .join("");
}

function reportPopulateTypes(types, statuses) {
   const sel = document.getElementById("report-type");
   const trainSel = document.getElementById("report-training-type");
   if (!sel) return;

   reportStatusMap = {};
   (statuses || []).forEach((s) => {
      reportStatusMap[s.report_type] = s;
   });

   sel.innerHTML = "";
   if (trainSel) trainSel.innerHTML = "";

   (types || []).forEach((type) => {
      const st = reportStatusMap[type];
      if (trainSel) {
         const trainOpt = document.createElement("option");
         trainOpt.value = type;
         trainOpt.textContent = type;
         trainSel.appendChild(trainOpt);
      }

      const option = document.createElement("option");
      option.value = type;
      option.textContent = st?.enabled ? type : `${type} (training required)`;
      option.disabled = !st?.enabled;
      sel.appendChild(option);
   });

   if (!sel.value) {
      const firstEnabled = (types || []).find((t) => reportStatusMap[t]?.enabled);
      if (firstEnabled) sel.value = firstEnabled;
   }

    if (trainSel && !trainSel.value && (types || []).length) {
      trainSel.value = types[0];
   }

   reportRenderTypeStatus();
   reportUpdateGenerateState();
}

function reportRenderTypeStatus() {
   const type = reportGetSelectedType();
   const status = reportStatusMap[type];

   if (!status) {
      reportSetSummary("Upload training files and select a report type.");
      reportSetStatus("Training required", "warn");
      return;
   }

   const caps = status.capabilities || {};
   const checks = [
      `Structure: ${caps.structure ? "✔" : "✖"}`,
      `Tone: ${caps.tone ? "✔" : "✖"}`,
      `Narrative: ${caps.narrative ? "✔" : "✖"}`,
      `Examples: ${caps.examples ? "✔" : "✖"}`,
   ].join("  |  ");

   reportSetSummary(`${status.reason || ""}  ${checks}`.trim());
   reportSetStatus(status.enabled ? "Ready" : "Training required", status.enabled ? "ok" : "warn");
}

async function loadReportMeta() {
   reportSetStatus("Loading report metadata...", "busy");
   try {
      const res = await fetch(`${REPORT_AGENT_API}/meta`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      reportPopulateStyles(data.report_styles || []);
      reportPopulateTypes(data.report_types || [], data.status || []);

      if ((data.status || []).some((s) => s.enabled)) {
         reportSetStatus("Ready", "ok");
      } else {
         reportSetStatus("Training required", "warn");
      }
   } catch (err) {
      reportSetStatus("Failed to load metadata", "bad");
      reportSetSummary(err.message || "Unable to load report metadata.");
   }
}

function reportValidateFiles(fileList) {
   const files = Array.from(fileList || []);
   if (!files.length) return "Select at least one training file.";

   for (const file of files) {
      const name = file.name || "";
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
      if (!REPORT_FILE_TYPES.includes(ext)) {
         return `Unsupported file type: ${ext || "unknown"}. Allowed: ${REPORT_FILE_TYPES.join(", ")}`;
      }
   }

   return null;
}

async function uploadTrainingFiles() {
   const type = reportGetSelectedTrainingType();
   const input = document.getElementById("report-training-files");
   if (!type) {
      reportSetStatus("Select a training category first", "warn");
      return;
   }

   const validation = reportValidateFiles(input?.files);
   if (validation) {
      reportSetStatus(validation, "warn");
      return;
   }

   reportSetStatus("Training...", "busy");
   reportSetSummary("Extracting structure, tone, narrative flow, and style examples from uploaded files.");

   const form = new FormData();
   form.append("report_type", type);
   for (const file of Array.from(input.files)) form.append("files", file);

   try {
      const res = await fetch(`${REPORT_AGENT_API}/train`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      if (input) input.value = "";
      await loadReportMeta();

      const st = data?.status;
      reportSetStatus(st?.enabled ? "Ready" : "Training required", st?.enabled ? "ok" : "warn");
      const genType = document.getElementById("report-type");
      if (genType && st?.report_type) {
         genType.value = st.report_type;
      }
      reportRenderTypeStatus();
   } catch (err) {
      reportSetStatus("Training failed", "bad");
      reportSetSummary(err.message || "Training upload failed.");
   }
}

function collectChartDataUrls() {
   const canvases = Array.from(document.querySelectorAll("canvas"));
   const charts = [];

   canvases.forEach((canvas, idx) => {
      try {
         const dataUrl = canvas.toDataURL("image/png");
         if (!dataUrl || dataUrl.length < 100) return;
         charts.push({
            name: canvas.id || `chart_${idx + 1}`,
            data_url: dataUrl,
         });
      } catch (_) {}
   });

   return charts;
}

function collectReportPayload() {
   const dashShared = window.__qpsDashShared || {};
   const snapshots = {
      mc: window.__qpsMcLatest || null,
      bs: dashShared.bs || null,
      greeks: dashShared.greeks || null,
      binomial: dashShared.bin || null,
      scenario: dashShared.scenario || null,
      multi_rate: dashShared.multi || null,
      volatility: dashShared.vol || null,
      batch: dashShared.batch || null,
      history: dashShared.history || null,
      live_market: dashShared.live || null,
   };

   return {
      report_type: reportGetSelectedType(),
      report_style: document.getElementById("report-style")?.value || "Concise Technical Summary",
      author: document.getElementById("report-author")?.value?.trim() || "QPS User",
      notes: document.getElementById("report-notes")?.value?.trim() || "",
      dash_shared: dashShared,
      snapshots,
      charts: collectChartDataUrls(),
   };
}

function resolveDownloadName(response, fallback) {
   const disp = response.headers.get("content-disposition") || "";
   const m = disp.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
   const candidate = decodeURIComponent(m?.[1] || m?.[2] || "").trim();
   return candidate || fallback;
}

async function generateWordReport() {
   const payload = collectReportPayload();
   const status = reportStatusMap[payload.report_type];
   if (!status?.enabled) {
      reportSetStatus("Selected report type is not trained yet", "warn");
      return;
   }

   reportSetStatus("Generating...", "busy");

   try {
      const res = await fetch(`${REPORT_AGENT_API}/generate`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      });

      if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         throw new Error(data?.detail || `Backend error (${res.status})`);
      }

      const blob = await res.blob();
      const name = resolveDownloadName(res, "qps_report.docx");
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      reportSetStatus("Ready", "ok");
      reportSetSummary(`Generated report: ${name}`);
   } catch (err) {
      reportSetStatus("Generation failed", "bad");
      reportSetSummary(err.message || "Unable to generate Word report.");
   }
}

window.addEventListener("DOMContentLoaded", () => {
   document.addEventListener("qps:page-activated", (event) => {
      if (event?.detail?.page !== "results") return;
      void loadReportMeta();
   });

   document.getElementById("report-type")?.addEventListener("change", () => {
      reportRenderTypeStatus();
      reportUpdateGenerateState();
   });

   document.getElementById("report-train-btn")?.addEventListener("click", () => {
      void uploadTrainingFiles();
   });

   document.getElementById("report-generate-btn")?.addEventListener("click", () => {
      void generateWordReport();
   });
});

window.loadReportMeta = loadReportMeta;
window.uploadTrainingFiles = uploadTrainingFiles;
window.generateWordReport = generateWordReport;
