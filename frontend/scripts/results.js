const RESULTS_API_BASE = `${window.__VELKYN_API_ORIGIN}/results/results`;
let activeResultFileBtn = null;
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);
const TABLE_EXTS = new Set([".csv", ".tsv", ".xlsx", ".xls", ".json"]);

const RESULT_ICONS = {
   caret: `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5.2 3.2a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 1 1-1.4-1.4L8.5 8 5.2 4.6a1 1 0 0 1 0-1.4z"/></svg>`,
   folder: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M2.5 5.5A2.5 2.5 0 0 1 5 3h3.2c.8 0 1.6.4 2 1.1l.4.6c.2.2.4.3.7.3H15A2.5 2.5 0 0 1 17.5 7.5v6A2.5 2.5 0 0 1 15 16H5a2.5 2.5 0 0 1-2.5-2.5v-8z"/></svg>`,
   file: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 2.5A2.5 2.5 0 0 0 2.5 5v10A2.5 2.5 0 0 0 5 17.5h10a2.5 2.5 0 0 0 2.5-2.5V8.8a2 2 0 0 0-.6-1.4l-4.3-4.3a2 2 0 0 0-1.4-.6H5zm6 1.8V7a1 1 0 0 0 1 1h2.7L11 4.3z"/></svg>`,
   fileJson: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 2.5A2.5 2.5 0 0 0 2.5 5v10A2.5 2.5 0 0 0 5 17.5h10a2.5 2.5 0 0 0 2.5-2.5V8.8a2 2 0 0 0-.6-1.4l-4.3-4.3a2 2 0 0 0-1.4-.6H5zm6 1.8V7a1 1 0 0 0 1 1h2.7L11 4.3zM6.2 11.2c0-.5.4-.9.9-.9h5.8c.5 0 .9.4.9.9s-.4.9-.9.9H7.1a.9.9 0 0 1-.9-.9zm0 2.8c0-.5.4-.9.9-.9h3.6c.5 0 .9.4.9.9s-.4.9-.9.9H7.1a.9.9 0 0 1-.9-.9z"/></svg>`,
   fileImage: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 15.5v-11zm3.2 2.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8.1 8.6-2.8-3.7a1 1 0 0 0-1.6 0l-2.2 2.9-1-1.3a1 1 0 0 0-1.6 0L4.8 15h9.5z"/></svg>`,
   fileTable: `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 15.5v-11zm1.8.5v2.8h10.4V5H4.8zm0 4.2v5.8h3.2V9.2H4.8zm4.6 0v5.8h5.8V9.2H9.4z"/></svg>`
};

function getFileExt(path) {
   if (!path || !path.includes(".")) return "";
   return `.${path.split(".").pop().toLowerCase()}`;
}

function resetImagePreview(message = "Select an image file from the tree to preview plot output.") {
   const img = document.getElementById("results-image");
   const empty = document.getElementById("results-image-empty");
   if (img) {
      img.style.display = "none";
      img.removeAttribute("src");
   }
   if (empty) {
      empty.style.display = "block";
      empty.textContent = message;
   }
}

function resetTablePreview(message = "Select a CSV/XLSX/JSON table-like file to preview rows.") {
   const meta = document.getElementById("results-table-meta");
   const head = document.getElementById("results-table-head");
   const body = document.getElementById("results-table-body");
   if (meta) meta.textContent = message;
   if (head) head.innerHTML = "";
   if (body) body.innerHTML = "";
}

function renderTablePreview(payload, relpath) {
   const meta = document.getElementById("results-table-meta");
   const head = document.getElementById("results-table-head");
   const body = document.getElementById("results-table-body");
   if (!meta || !head || !body) return;

   const columns = Array.isArray(payload?.columns) ? payload.columns : [];
   const rows = Array.isArray(payload?.rows) ? payload.rows : [];

   if (!columns.length) {
      meta.textContent = `No table columns found in ${relpath}.`;
      head.innerHTML = "";
      body.innerHTML = "";
      return;
   }

   const headRow = document.createElement("tr");
   columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = String(col);
      headRow.appendChild(th);
   });
   head.innerHTML = "";
   head.appendChild(headRow);

   body.innerHTML = "";
   rows.forEach((row) => {
      const tr = document.createElement("tr");
      columns.forEach((_, idx) => {
         const td = document.createElement("td");
         td.textContent = row?.[idx] == null ? "" : String(row[idx]);
         tr.appendChild(td);
      });
      body.appendChild(tr);
   });

   const rowLabel = payload?.truncated
      ? `showing ${rows.length} of ${payload.total_rows} rows`
      : `${rows.length} rows`;
   meta.textContent = `${relpath} • ${payload.total_cols} cols • ${rowLabel}`;
}

function setResultsEmpty(message) {
   const empty = document.getElementById("results-empty");
   if (!empty) return;
   empty.style.display = "block";
   empty.textContent = message;
}

function hideResultsEmpty() {
   const empty = document.getElementById("results-empty");
   if (!empty) return;
   empty.style.display = "none";
}

async function loadResultsSessions() {
   setResultsEmpty("Loading results sessions...");
   resetImagePreview();
   resetTablePreview();

   const sel = document.getElementById("results-session");
   if (!sel) return;

   try {
      const res = await fetch(`${RESULTS_API_BASE}/sessions`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      if (!sessions.length) {
         sel.innerHTML = "";
         setResultsEmpty("No sessions found yet. Run an engine to create timestamped results.");
         renderResultsTree({ name: "sessions", type: "dir", children: [] }, "");
         return;
      }

      sel.innerHTML = sessions.map((s) => `<option value="${s}">${s}</option>`).join("");
      hideResultsEmpty();
      await loadResultsTree();
   } catch (err) {
      setResultsEmpty(err.message || "Failed to load sessions.");
   }
}

function renderResultsTree(tree, session) {
   const host = document.getElementById("results-tree");
   if (!host) return;
   host.innerHTML = "";
   activeResultFileBtn = null;

   const root = document.createElement("ul");
   root.className = "results-tree-root";

   const appendFileNode = (listEl, node, relPath) => {
      const li = document.createElement("li");
      const ext = getFileExt(node.name);
      const icon = IMAGE_EXTS.has(ext)
         ? `<span class="icon file">${RESULT_ICONS.fileImage}</span>`
         : ext === ".json"
            ? `<span class="icon file-json">${RESULT_ICONS.fileJson}</span>`
            : TABLE_EXTS.has(ext)
            ? `<span class="icon file-json">${RESULT_ICONS.fileTable}</span>`
            : `<span class="icon file">${RESULT_ICONS.file}</span>`;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "results-file";
      btn.innerHTML = `${icon}<span class="node-name">${node.name}</span>`;
      btn.addEventListener("click", async () => {
         if (activeResultFileBtn) activeResultFileBtn.classList.remove("active");
         btn.classList.add("active");
         activeResultFileBtn = btn;
         await loadResultFile(session, relPath);
      });
      li.appendChild(btn);
      listEl.appendChild(li);
   };

   const appendDirNode = (listEl, node, pathPrefix = "") => {
      const children = Array.isArray(node.children) ? node.children : [];
      const li = document.createElement("li");
      const details = document.createElement("details");
      details.open = true;

      const summary = document.createElement("summary");
      summary.innerHTML = `<span class="caret">${RESULT_ICONS.caret}</span><span class="icon folder">${RESULT_ICONS.folder}</span><span class="node-name">${node.name}</span>`;
      details.appendChild(summary);

      const childList = document.createElement("ul");
      children.forEach((child) => {
         const childRel = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;
         if (child.type === "dir") {
            appendDirNode(childList, child, childRel);
         } else {
            appendFileNode(childList, child, childRel);
         }
      });

      details.appendChild(childList);
      li.appendChild(details);
      listEl.appendChild(li);
   };

   const treeRoot = tree?.type === "dir" ? tree : { name: session, type: "dir", children: [] };
   appendDirNode(root, treeRoot, "");
   host.appendChild(root);
}

async function loadResultsTree() {
   const sel = document.getElementById("results-session");
   if (!sel?.value) {
      setResultsEmpty("Select a session first.");
      return;
   }

   resetImagePreview();
   resetTablePreview();

   try {
      const session = encodeURIComponent(sel.value);
      const res = await fetch(`${RESULTS_API_BASE}/tree?session=${session}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      renderResultsTree(data.tree || { name: sel.value, type: "dir", children: [] }, sel.value);
      hideResultsEmpty();
   } catch (err) {
      setResultsEmpty(err.message || "Failed to load results tree.");
   }
}

async function loadResultFile(session, relpath) {
   const preview = document.getElementById("results-preview");
   if (!preview) return;

    const ext = getFileExt(relpath);

    if (IMAGE_EXTS.has(ext)) {
      preview.textContent = `Rendering image: ${relpath}`;
      resetTablePreview();
      const img = document.getElementById("results-image");
      const empty = document.getElementById("results-image-empty");
      if (img) {
         const qSession = encodeURIComponent(session);
         const qPath = encodeURIComponent(relpath);
         img.src = `${RESULTS_API_BASE}/asset?session=${qSession}&relpath=${qPath}&v=${Date.now()}`;
         img.style.display = "block";
      }
      if (empty) empty.style.display = "none";
      return;
   }

   resetImagePreview();

   if (TABLE_EXTS.has(ext)) {
      try {
         const qSession = encodeURIComponent(session);
         const qPath = encodeURIComponent(relpath);
         const tableRes = await fetch(`${RESULTS_API_BASE}/table?session=${qSession}&relpath=${qPath}&max_rows=200`, { cache: "no-store" });
         const tableData = await tableRes.json();
         if (!tableRes.ok) throw new Error(tableData?.detail || `Backend error (${tableRes.status})`);
         renderTablePreview(tableData, relpath);
      } catch (err) {
         resetTablePreview(err.message || "Failed to parse table file.");
      }
   } else {
      resetTablePreview();
   }

   if (ext === ".xlsx" || ext === ".xls") {
      preview.textContent = `Spreadsheet selected: ${relpath}\n\nUse the table preview panel to inspect rows and columns.`;
      return;
   }

   preview.textContent = `Loading ${relpath}...`;

   try {
      const qSession = encodeURIComponent(session);
      const qPath = encodeURIComponent(relpath);
      const res = await fetch(`${RESULTS_API_BASE}/file?session=${qSession}&relpath=${qPath}&max_chars=30000`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Backend error (${res.status})`);

      preview.textContent = data.content || "(empty file)";
      if (data.truncated) {
         preview.textContent += "\n\n[Preview truncated]";
      }
   } catch (err) {
      preview.textContent = err.message || "Failed to load file.";
   }
}

window.addEventListener("DOMContentLoaded", () => {
   document.addEventListener("qps:page-activated", (event) => {
      if (event?.detail?.page !== "results") return;
      void loadResultsSessions();
   });
});

window.loadResultsSessions = loadResultsSessions;
window.loadResultsTree = loadResultsTree;
window.loadResultFile = loadResultFile;

console.log("Results module loaded.");
