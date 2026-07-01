/**
 * SinAI Chrome Extension Popup Script
 * Includes browser fallbacks for direct previewing without crashing.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ── DOM References ──
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const apiStatusDot = document.querySelector("#api-status-indicator .status-dot");
  const apiStatusText = document.querySelector("#api-status-indicator .status-text");

  // Dashboard Tab
  const statTotalChecks = document.getElementById("stat-total-checks");
  const statToolsUsed = document.getElementById("stat-tools-used");
  const toggleInlineHelper = document.getElementById("toggle-inline-helper");

  // Tools Tab
  const selectActiveTool = document.getElementById("select-active-tool");
  const toolOptionsStyleRewriter = document.getElementById("options-style-rewriter");
  const toolOptionsSummarizer = document.getElementById("options-summarizer");
  const toolTextareaInput = document.getElementById("tool-textarea-input");
  const toolCharCount = document.getElementById("tool-char-count");
  const btnProcessTool = document.getElementById("btn-process-tool");
  const btnClearTool = document.getElementById("btn-clear-tool");
  const toolResultContainer = document.getElementById("tool-result-container");
  const toolResultOutput = document.getElementById("tool-result-output");
  const btnCopyResult = document.getElementById("btn-copy-result");
  const grammarCorrectionsList = document.getElementById("grammar-corrections-list");

  // History Tab
  const historyItemsContainer = document.getElementById("history-items-container");
  const btnClearHistory = document.getElementById("btn-clear-history");

  // Settings Tab
  const inputApiHost = document.getElementById("input-api-host");
  const btnTestConnection = document.getElementById("btn-test-connection");
  const selectDefaultTone = document.getElementById("select-default-tone");
  const selectDefaultLength = document.getElementById("select-default-length");
  const inputDefaultHeadlines = document.getElementById("input-default-headlines");
  const btnSaveSettings = document.getElementById("btn-save-settings");

  // ── Safe Chrome API Wrappers (for Web Previews) ──
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

  const sendMessage = (message, callback) => {
    if (isExtensionContext && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, callback);
    } else {
      // Fallback: Direct API request if previewed as standard page
      const apiHost = extensionSettings.apiHost || "http://localhost:8000/api/v1";
      const url = `${apiHost}${message.endpoint}`;
      
      fetch(url, {
        method: message.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: message.body ? JSON.stringify(message.body) : undefined
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.message || `HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          callback({ success: true, data });
          saveToFallbackHistory(message.endpoint, message.body, data);
        })
        .catch((err) => {
          callback({ success: false, error: err.message });
        });
    }
  };

  function saveToFallbackHistory(endpoint, requestBody, responseData) {
    if (isExtensionContext) return; // background.js already handles this in extension
    
    let type = "grammar";
    let snippet = requestBody.text;
    let resultSummary = "";

    if (endpoint.includes("/grammar/check")) {
      type = "grammar";
      resultSummary = responseData.corrected;
    } else if (endpoint.includes("/headlines/generate")) {
      type = "headlines";
      resultSummary = responseData.headlines.join(", ");
    } else if (endpoint.includes("/rewrite")) {
      type = "rewriter";
      resultSummary = responseData.rewritten;
    } else if (endpoint.includes("/summarize")) {
      type = "summarizer";
      resultSummary = responseData.summary;
    } else {
      return;
    }

    storage.get(["history"], (data) => {
      const historyList = data.history || [];
      const newItem = {
        id: "hist_" + Date.now(),
        type,
        timestamp: new Date().toISOString(),
        original: snippet,
        result: resultSummary
      };
      const updatedHistory = [newItem, ...historyList].slice(0, 50);
      storage.set({ history: updatedHistory });
    });
  }

  // ── State Variables ──
  let extensionSettings = {
    apiHost: "http://localhost:8000/api/v1",
    inlineEnabled: true,
    defaultTone: "formal",
    defaultLength: "medium",
    defaultHeadlineCount: 5
  };
  let activeToolState = {
    tool: "grammar",
    tone: "formal",
    length: "medium"
  };

  // ── Initialize App ──
  loadSettingsAndData();
  setupNavigation();
  setupToolEvents();
  setupSettingsEvents();
  setupHistoryEvents();
  checkApiHealth();

  // ── Tab Navigation ──
  function setupNavigation() {
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const targetPanelId = item.getAttribute("data-target");

        // Remove active class from nav items and panels
        navItems.forEach((btn) => btn.classList.remove("active"));
        tabPanels.forEach((panel) => panel.classList.remove("active"));

        // Add active to current
        item.classList.add("active");
        const activePanel = document.getElementById(targetPanelId);
        if (activePanel) {
          activePanel.classList.add("active");
        }

        // If tab is history or dashboard, reload stats/list
        if (targetPanelId === "panel-history") {
          renderHistoryList();
        } else if (targetPanelId === "panel-dashboard") {
          updateDashboardStats();
        }
      });
    });
  }

  // ── Settings Management ──
  function loadSettingsAndData() {
    storage.get(
      ["apiHost", "inlineEnabled", "defaultTone", "defaultLength", "defaultHeadlineCount", "history"],
      (items) => {
        if (items.apiHost) extensionSettings.apiHost = items.apiHost;
        if (items.inlineEnabled !== undefined) extensionSettings.inlineEnabled = items.inlineEnabled;
        if (items.defaultTone) extensionSettings.defaultTone = items.defaultTone;
        if (items.defaultLength) extensionSettings.defaultLength = items.defaultLength;
        if (items.defaultHeadlineCount) extensionSettings.defaultHeadlineCount = items.defaultHeadlineCount;

        // Apply to Settings UI
        inputApiHost.value = extensionSettings.apiHost;
        toggleInlineHelper.checked = extensionSettings.inlineEnabled;
        selectDefaultTone.value = extensionSettings.defaultTone;
        selectDefaultLength.value = extensionSettings.defaultLength;
        inputDefaultHeadlines.value = extensionSettings.defaultHeadlineCount;

        // Apply defaults to active tool state
        activeToolState.tone = extensionSettings.defaultTone;
        activeToolState.length = extensionSettings.defaultLength;

        // Apply active segmented buttons
        document.querySelectorAll("#options-style-rewriter .seg-btn").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-value") === activeToolState.tone);
        });
        document.querySelectorAll("#options-summarizer .seg-btn").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-value") === activeToolState.length);
        });

        updateDashboardStats(items.history);
      }
    );
  }

  function setupSettingsEvents() {
    btnSaveSettings.addEventListener("click", () => {
      const updated = {
        apiHost: inputApiHost.value.trim() || "http://localhost:8000/api/v1",
        defaultTone: selectDefaultTone.value,
        defaultLength: selectDefaultLength.value,
        defaultHeadlineCount: parseInt(inputDefaultHeadlines.value, 10) || 5
      };

      storage.set(updated, () => {
        extensionSettings = { ...extensionSettings, ...updated };
        
        // Show success visual feedback on button
        const originalText = btnSaveSettings.textContent;
        btnSaveSettings.textContent = "සුරැකිණි (Saved!)";
        btnSaveSettings.style.background = "#10B981";
        setTimeout(() => {
          btnSaveSettings.textContent = originalText;
          btnSaveSettings.style.background = "";
        }, 1500);

        checkApiHealth(); // recheck with new host
      });
    });

    toggleInlineHelper.addEventListener("change", (e) => {
      storage.set({ inlineEnabled: e.target.checked }, () => {
        extensionSettings.inlineEnabled = e.target.checked;
      });
    });

    btnTestConnection.addEventListener("click", () => {
      const originalText = btnTestConnection.textContent;
      btnTestConnection.textContent = "Testing...";
      btnTestConnection.disabled = true;

      checkApiHealth((connected) => {
        btnTestConnection.textContent = originalText;
        btnTestConnection.disabled = false;
        
        if (connected) {
          btnTestConnection.style.borderColor = "#10B981";
          btnTestConnection.style.color = "#10B981";
        } else {
          btnTestConnection.style.borderColor = "#EF4444";
          btnTestConnection.style.color = "#EF4444";
        }
        setTimeout(() => {
          btnTestConnection.style.borderColor = "";
          btnTestConnection.style.color = "";
        }, 1500);
      });
    });
  }

  // ── API Health Check ──
  function checkApiHealth(callback) {
    const apiHost = inputApiHost.value.trim() || extensionSettings.apiHost;
    const healthUrl = apiHost.replace(/\/api\/v1\/?$/, "") + "/health";

    apiStatusDot.className = "status-dot warning";
    apiStatusText.textContent = "Checking...";

    fetch(healthUrl, { method: "GET" })
      .then((res) => {
        if (res.ok) {
          apiStatusDot.className = "status-dot success";
          apiStatusText.textContent = "Connected";
          if (callback) callback(true);
        } else {
          throw new Error("Offline");
        }
      })
      .catch(() => {
        apiStatusDot.className = "status-dot error";
        apiStatusText.textContent = "Offline";
        if (callback) callback(false);
      });
  }

  // ── Tools Processing ──
  function setupToolEvents() {
    // Tool Selection Switch
    selectActiveTool.addEventListener("change", (e) => {
      const tool = e.target.value;
      activeToolState.tool = tool;

      // Hide all options panels first
      toolOptionsStyleRewriter.classList.add("hidden");
      toolOptionsSummarizer.classList.add("hidden");

      // Show the selected options panel
      if (tool === "rewriter") {
        toolOptionsStyleRewriter.classList.remove("hidden");
        toolTextareaInput.placeholder = "නැවත ලිවීමට අවශ්‍ය සිංහල පෙළ මෙහි ඇතුළත් කරන්න...";
      } else if (tool === "summarizer") {
        toolOptionsSummarizer.classList.remove("hidden");
        toolTextareaInput.placeholder = "සාරාංශ කිරීමට බලාපොරොත්තු වන දිගු සිංහල ලිපිය මෙහි ඇතුළත් කරන්න...";
      } else if (tool === "headlines") {
        toolTextareaInput.placeholder = "සිරස්තල නිර්මාණය කිරීමට අදාළ ප්‍රවෘත්තිය හෝ විස්තරය මෙහි ඇතුළත් කරන්න...";
      } else {
        toolTextareaInput.placeholder = "මෙහි ඔබගේ සිංහල වාක්‍යය ඇතුළත් කරන්න...";
      }

      // Hide previous result when switching tools
      toolResultContainer.classList.add("hidden");
    });

    // Segmented Button Clicks (Options)
    document.querySelectorAll(".segmented-control .seg-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const parent = btn.parentElement;
        parent.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const val = btn.getAttribute("data-value");
        if (parent.parentElement.id === "options-style-rewriter") {
          activeToolState.tone = val;
        } else if (parent.parentElement.id === "options-summarizer") {
          activeToolState.length = val;
        }
      });
    });

    // Textarea Characters Tracker
    toolTextareaInput.addEventListener("input", () => {
      const text = toolTextareaInput.value;
      toolCharCount.textContent = `${text.length.toLocaleString()} / 10,000`;
      btnProcessTool.disabled = text.trim().length === 0;
    });

    // Clear Input
    btnClearTool.addEventListener("click", () => {
      toolTextareaInput.value = "";
      toolCharCount.textContent = "0 / 10,000";
      btnProcessTool.disabled = true;
      toolResultContainer.classList.add("hidden");
      grammarCorrectionsList.classList.add("hidden");
      toolTextareaInput.focus();
    });

    // Copy Result
    btnCopyResult.addEventListener("click", () => {
      const text = toolResultOutput.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalSvg = btnCopyResult.innerHTML;
        btnCopyResult.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#10B981" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
        setTimeout(() => {
          btnCopyResult.innerHTML = originalSvg;
        }, 1500);
      });
    });

    // Run Processing Tool
    btnProcessTool.addEventListener("click", () => {
      const inputVal = toolTextareaInput.value.trim();
      if (!inputVal) return;

      btnProcessTool.disabled = true;
      btnProcessTool.classList.add("loading");
      toolResultContainer.classList.add("hidden");
      grammarCorrectionsList.classList.add("hidden");

      let endpoint = "/grammar/check";
      let body = { text: inputVal };

      if (activeToolState.tool === "headlines") {
        endpoint = "/headlines/generate";
        body = { text: inputVal, count: extensionSettings.defaultHeadlineCount };
      } else if (activeToolState.tool === "rewriter") {
        endpoint = "/rewrite";
        body = { text: inputVal, tone: activeToolState.tone };
      } else if (activeToolState.tool === "summarizer") {
        endpoint = "/summarize";
        body = { text: inputVal, length: activeToolState.length };
      }

      sendMessage(
        {
          action: "callApi",
          endpoint,
          body,
          method: "POST"
        },
        (response) => {
          btnProcessTool.disabled = false;
          btnProcessTool.classList.remove("loading");

          if (!response || !response.success) {
            showError(response ? response.error : "Failed to connect to server.");
            return;
          }

          renderToolResult(activeToolState.tool, response.data);
        }
      );
    });
  }

  // ── Render Tool Output ──
  function renderToolResult(tool, data) {
    toolResultContainer.classList.remove("hidden");
    grammarCorrectionsList.innerHTML = "";
    grammarCorrectionsList.classList.add("hidden");

    if (tool === "grammar") {
      toolResultOutput.textContent = data.corrected;
      
      if (data.corrections && data.corrections.length > 0) {
        grammarCorrectionsList.classList.remove("hidden");
        
        data.corrections.forEach((c) => {
          const detailItem = document.createElement("div");
          detailItem.className = "correction-detail-item";
          detailItem.innerHTML = `
            <div class="correction-comparison">
              <span class="corr-orig">${escapeHtml(c.original)}</span>
              <span class="corr-arrow">➔</span>
              <span class="corr-new">${escapeHtml(c.corrected)}</span>
            </div>
            <div class="correction-rule">${escapeHtml(c.rule)}</div>
          `;
          grammarCorrectionsList.appendChild(detailItem);
        });
      } else {
        grammarCorrectionsList.classList.remove("hidden");
        grammarCorrectionsList.innerHTML = `<div class="empty-state" style="padding: 10px 0;"><p style="color: #10B981; font-size: 0.8rem;">👍 මෙම පාඨයේ ව්‍යාකරණ දෝෂ කිසිවක් හමු නොවීය.</p></div>`;
      }
    } else if (tool === "headlines") {
      const ol = document.createElement("ol");
      ol.style.paddingLeft = "20px";
      ol.style.margin = "0";
      
      data.headlines.forEach((h) => {
        const li = document.createElement("li");
        li.textContent = h;
        li.style.marginBottom = "8px";
        ol.appendChild(li);
      });
      
      toolResultOutput.innerHTML = "";
      toolResultOutput.appendChild(ol);
    } else if (tool === "rewriter") {
      toolResultOutput.textContent = data.rewritten;
    } else if (tool === "summarizer") {
      toolResultOutput.textContent = data.summary;
    }
  }

  function showError(msg) {
    toolResultContainer.classList.remove("hidden");
    toolResultOutput.innerHTML = `<span style="color: #EF4444; font-weight: 500;">ERROR: ${escapeHtml(msg)}</span><br><span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; display: block;">API සේවා ක්‍රියාත්මක දැයි සහ සැකසුම් (Settings) පරීක්ෂා කරන්න.</span>`;
  }

  // ── History Listing ──
  function setupHistoryEvents() {
    btnClearHistory.addEventListener("click", () => {
      storage.set({ history: [] }, () => {
        renderHistoryList();
        updateDashboardStats([]);
      });
    });
  }

  function renderHistoryList() {
    storage.get(["history"], (data) => {
      const list = data.history || [];
      historyItemsContainer.innerHTML = "";

      if (list.length === 0) {
        historyItemsContainer.innerHTML = `
          <div class="empty-state">
            <p>පසුගිය ක්‍රියාකාරකම් කිසිවක් නැත.</p>
          </div>
        `;
        return;
      }

      list.forEach((item) => {
        const card = document.createElement("div");
        card.className = "history-card";
        
        let typeLabel = "Grammar";
        if (item.type === "headlines") typeLabel = "Headlines";
        if (item.type === "rewriter") typeLabel = "Rewriter";
        if (item.type === "summarizer") typeLabel = "Summarizer";

        const timeString = formatTime(item.timestamp);

        card.innerHTML = `
          <div class="history-card-header">
            <span class="history-badge ${item.type}">${typeLabel}</span>
            <span class="history-time">${timeString}</span>
          </div>
          <div class="history-snippet" title="${escapeHtml(item.original)}">මුල් පෙළ: ${escapeHtml(item.original)}</div>
          <div class="history-result" title="${escapeHtml(item.result)}">ප්‍රතිඵලය: ${escapeHtml(item.result)}</div>
        `;
        
        card.addEventListener("click", () => {
          selectActiveTool.value = item.type;
          selectActiveTool.dispatchEvent(new Event("change"));
          toolTextareaInput.value = item.original;
          toolTextareaInput.dispatchEvent(new Event("input"));
          document.querySelector(".nav-item[data-target='panel-tools']").click();
        });

        historyItemsContainer.appendChild(card);
      });
    });
  }

  // ── Dashboard Stats ──
  function updateDashboardStats(historyCache) {
    if (historyCache) {
      applyStats(historyCache);
    } else {
      storage.get(["history"], (data) => {
        applyStats(data.history || []);
      });
    }

    function applyStats(list) {
      statTotalChecks.textContent = list.length;
      
      const uniqueTools = new Set(list.map(h => h.type));
      statToolsUsed.textContent = uniqueTools.size;
    }
  }

  // ── Helper Utility Functions ──
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return "";
    }
  }
});
