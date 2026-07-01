/**
 * SinAI Chrome Extension Options Page Controller
 * Includes browser fallbacks for direct previewing without crashing.
 */

const DEFAULT_SETTINGS = {
  apiHost: "https://sinhalajournalllm.onrender.com/api/v1",
  inlineEnabled: true,
  defaultTone: "formal",
  defaultLength: "medium",
  defaultHeadlineCount: 5
};

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const checkInlineEnabled = document.getElementById("options-inline-enabled");
  const inputApiHost = document.getElementById("options-api-host");
  const selectDefaultTone = document.getElementById("options-default-tone");
  const selectDefaultLength = document.getElementById("options-default-length");
  const inputDefaultHeadlines = document.getElementById("options-default-headlines");
  
  const btnTest = document.getElementById("options-btn-test");
  const btnSave = document.getElementById("options-btn-save");
  const btnReset = document.getElementById("options-btn-reset");
  
  const statusBadge = document.getElementById("options-status-badge");
  const statusDot = statusBadge.querySelector(".status-dot");
  const statusText = statusBadge.querySelector(".status-text");

  // ── Safe Storage Wrapper ──
  const isExtensionContext = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  const storage = {
    get: (keys, callback) => {
      if (isExtensionContext) {
        chrome.storage.local.get(keys, callback);
      } else {
        const result = {};
        keys.forEach((key) => {
          const val = localStorage.getItem("sinai_" + key);
          if (val !== null) {
            try {
              result[key] = JSON.parse(val);
            } catch {
              result[key] = val;
            }
          }
        });
        callback(result);
      }
    },
    set: (items, callback) => {
      if (isExtensionContext) {
        chrome.storage.local.set(items, callback);
      } else {
        Object.entries(items).forEach(([key, val]) => {
          localStorage.setItem("sinai_" + key, JSON.stringify(val));
        });
        if (callback) callback();
      }
    }
  };

  // Load Settings
  loadSettings();
  
  // Event listeners
  btnSave.addEventListener("click", saveSettings);
  btnReset.addEventListener("click", resetToDefaults);
  btnTest.addEventListener("click", () => checkApiHealth(inputApiHost.value.trim()));
  inputApiHost.addEventListener("blur", () => checkApiHealth(inputApiHost.value.trim()));

  function loadSettings() {
    storage.get(
      ["apiHost", "inlineEnabled", "defaultTone", "defaultLength", "defaultHeadlineCount"],
      (items) => {
        checkInlineEnabled.checked = items.inlineEnabled !== undefined ? items.inlineEnabled : DEFAULT_SETTINGS.inlineEnabled;
        inputApiHost.value = items.apiHost || DEFAULT_SETTINGS.apiHost;
        selectDefaultTone.value = items.defaultTone || DEFAULT_SETTINGS.defaultTone;
        selectDefaultLength.value = items.defaultLength || DEFAULT_SETTINGS.defaultLength;
        inputDefaultHeadlines.value = items.defaultHeadlineCount || DEFAULT_SETTINGS.defaultHeadlineCount;

        checkApiHealth(inputApiHost.value);
      }
    );
  }

  function saveSettings() {
    const apiHostVal = inputApiHost.value.trim() || DEFAULT_SETTINGS.apiHost;
    const inlineEnabledVal = checkInlineEnabled.checked;
    const defaultToneVal = selectDefaultTone.value;
    const defaultLengthVal = selectDefaultLength.value;
    const defaultHeadlineCountVal = parseInt(inputDefaultHeadlines.value, 10) || DEFAULT_SETTINGS.defaultHeadlineCount;

    storage.set(
      {
        apiHost: apiHostVal,
        inlineEnabled: inlineEnabledVal,
        defaultTone: defaultToneVal,
        defaultLength: defaultLengthVal,
        defaultHeadlineCount: defaultHeadlineCountVal
      },
      () => {
        // Visual feedback
        const originalText = btnSave.textContent;
        btnSave.textContent = "සැකසුම් සුරැකිණි! (Settings Saved)";
        btnSave.style.background = "#10B981";
        
        setTimeout(() => {
          btnSave.textContent = originalText;
          btnSave.style.background = "";
        }, 2000);

        checkApiHealth(apiHostVal);
      }
    );
  }

  function resetToDefaults() {
    if (confirm("ඔබට සියලු සැකසුම් පෙරනිමි තත්වයට පත් කිරීමට අවශ්‍යද? (Reset all settings to defaults?)")) {
      storage.set(DEFAULT_SETTINGS, () => {
        loadSettings();
        
        const originalText = btnReset.textContent;
        btnReset.textContent = "Reset Done";
        setTimeout(() => {
          btnReset.textContent = originalText;
        }, 1500);
      });
    }
  }

  function checkApiHealth(apiHost) {
    const healthUrl = apiHost.replace(/\/api\/v1\/?$/, "") + "/health";

    statusDot.className = "status-dot checking";
    statusText.textContent = "Checking...";

    fetch(healthUrl, { method: "GET" })
      .then((res) => {
        if (res.ok) {
          statusDot.className = "status-dot success";
          statusText.textContent = "Connected";
        } else {
          throw new Error("Offline");
        }
      })
      .catch(() => {
        statusDot.className = "status-dot error";
        statusText.textContent = "Offline";
      });
  }
});
