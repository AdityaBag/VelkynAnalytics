const SETTINGS_DEFAULTS = {
   apiStocks: "yahoo",
   apiCrypto: "yahoo",
   apiBackend: "local-fastapi",
   defaultTicker: "AAPL",
   defaultMarket: "NASDAQ",
   defaultOptionType: "call",
   defaultRate: "0.05",
   defaultVol: "0.2",
   autoRefresh: "on",
   pollSeconds: "2",
   marketHoursOnly: "on",
   historyRetention: "365d",
   defaultPage: "home",
};

const SETTINGS_FIELDS = {
   apiStocks: "set-api-stocks",
   apiCrypto: "set-api-crypto",
   apiBackend: "set-api-backend",
   defaultTicker: "set-default-ticker",
   defaultMarket: "set-default-market",
   defaultOptionType: "set-default-option-type",
   defaultRate: "set-default-rate",
   defaultVol: "set-default-vol",
   autoRefresh: "set-auto-refresh",
   pollSeconds: "set-poll-seconds",
   marketHoursOnly: "set-market-hours-only",
   historyRetention: "set-history-retention",
   defaultPage: "set-default-page",
};

function setSettingsStatus(text, ok = true) {
   const el = document.getElementById("settings-status");
   if (!el) return;
   el.textContent = text;
   el.style.color = ok ? "#8fe3c8" : "#ff9aa7";
}

function writeSettingsToForm(settings) {
   Object.entries(SETTINGS_FIELDS).forEach(([key, fieldId]) => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      const val = settings?.[key];
      if (val == null) return;
      el.value = String(val);
   });
}

function readSettingsFromForm() {
   const out = {};
   Object.entries(SETTINGS_FIELDS).forEach(([key, fieldId]) => {
      const el = document.getElementById(fieldId);
      if (!el) return;
      out[key] = String(el.value ?? "");
   });
   return out;
}

function applySettingsSystemInfo() {
   const host = window.location.hostname || "localhost";
   const protocol = window.location.protocol || "http:";
   const backendOrigin = window.__VELKYN_API_ORIGIN || "http://127.0.0.1:8000";

   const backendEl = document.getElementById("set-info-backend");
   const frontendEl = document.getElementById("set-info-frontend");
   const envEl = document.getElementById("set-info-env");

   if (backendEl) backendEl.textContent = backendOrigin.replace(/^https?:\/\//, "");
   if (frontendEl) frontendEl.textContent = `${host}:${window.location.port || "5500"}`;
   if (envEl) envEl.textContent = host === "localhost" || host === "127.0.0.1" ? "Local Development" : `Public Preview (${protocol.replace(":", "")})`;
}

function saveSettings() {
   try {
      readSettingsFromForm();
      setSettingsStatus(`Preview saved at ${new Date().toLocaleTimeString()} (showcase mode only).`, true);
   } catch (err) {
      setSettingsStatus(err?.message || "Failed to save preferences.", false);
   }
}

function resetSettings() {
   writeSettingsToForm(SETTINGS_DEFAULTS);
   setSettingsStatus("Preview defaults restored (showcase mode only).", true);
}

window.addEventListener("DOMContentLoaded", () => {
   writeSettingsToForm(SETTINGS_DEFAULTS);
   applySettingsSystemInfo();
   setSettingsStatus("Showcase mode active.", true);
});

window.saveSettings = saveSettings;
window.resetSettings = resetSettings;

console.log("Settings module loaded.");
