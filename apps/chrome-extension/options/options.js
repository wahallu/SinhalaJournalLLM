/**
 * SinAI Chrome Extension Options Page Controller
 * Includes browser fallbacks for direct previewing without crashing.
 */

const DEFAULT_SETTINGS = {
  apiHost: "https://backend.sin-ai.app/api/v1",
  inlineEnabled: true,
  defaultTone: "formal",
  defaultLength: "medium",
  defaultHeadlineCount: 5
};

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const checkInlineEnabled = document.getElementById("options-inline-enabled");
  const selectDefaultTone = document.getElementById("options-default-tone");
  const selectDefaultLength = document.getElementById("options-default-length");
  const inputDefaultHeadlines = document.getElementById("options-default-headlines");

  const btnSave = document.getElementById("options-btn-save");
  const btnReset = document.getElementById("options-btn-reset");
  const resetBtnDefaultLabel = btnReset.textContent;

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

  function loadSettings() {
    storage.get(
      ["apiHost", "inlineEnabled", "defaultTone", "defaultLength", "defaultHeadlineCount"],
      (items) => {
        checkInlineEnabled.checked = items.inlineEnabled !== undefined ? items.inlineEnabled : DEFAULT_SETTINGS.inlineEnabled;
        selectDefaultTone.value = items.defaultTone || DEFAULT_SETTINGS.defaultTone;
        selectDefaultLength.value = items.defaultLength || DEFAULT_SETTINGS.defaultLength;
        inputDefaultHeadlines.value = items.defaultHeadlineCount || DEFAULT_SETTINGS.defaultHeadlineCount;

        checkApiHealth(items.apiHost || DEFAULT_SETTINGS.apiHost);
      }
    );
  }

  function saveSettings() {
    const inlineEnabledVal = checkInlineEnabled.checked;
    const defaultToneVal = selectDefaultTone.value;
    const defaultLengthVal = selectDefaultLength.value;
    const defaultHeadlineCountVal = parseInt(inputDefaultHeadlines.value, 10) || DEFAULT_SETTINGS.defaultHeadlineCount;

    storage.set(
      {
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

        checkApiHealth(DEFAULT_SETTINGS.apiHost);
      }
    );
  }

  // Two-click inline confirm rather than a native confirm() dialog, matching
  // the app's no-native-dialogs convention: first click arms it and shows a
  // "click again" state that disarms itself after a few seconds; only the
  // second click within that window actually resets.
  let resetArmed = false;
  let resetArmedTimeout = null;

  function disarmReset() {
    resetArmed = false;
    clearTimeout(resetArmedTimeout);
    btnReset.textContent = resetBtnDefaultLabel;
    btnReset.classList.remove("btn-confirm-armed");
  }

  function resetToDefaults() {
    if (!resetArmed) {
      resetArmed = true;
      btnReset.textContent = "Click again to confirm";
      btnReset.classList.add("btn-confirm-armed");
      resetArmedTimeout = setTimeout(disarmReset, 3000);
      return;
    }

    disarmReset();
    storage.set(DEFAULT_SETTINGS, () => {
      loadSettings();

      btnReset.textContent = "Reset Done";
      setTimeout(() => {
        btnReset.textContent = resetBtnDefaultLabel;
      }, 1500);
    });
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
