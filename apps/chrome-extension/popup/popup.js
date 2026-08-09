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
  const toolOptionsOptimize = document.getElementById("options-optimize");
  const optimizeToggleRestyle = document.getElementById("optimize-toggle-restyle");
  const optimizeToneControl = document.getElementById("optimize-tone-control");
  const optimizeToggleSummarize = document.getElementById("optimize-toggle-summarize");
  const optimizeLengthControl = document.getElementById("optimize-length-control");
  const toolTextareaInput = document.getElementById("tool-textarea-input");
  const toolCharCount = document.getElementById("tool-char-count");
  const btnProcessTool = document.getElementById("btn-process-tool");
  const btnClearTool = document.getElementById("btn-clear-tool");
  const toolResultContainer = document.getElementById("tool-result-container");
  const toolResultOutput = document.getElementById("tool-result-output");
  const btnCopyResult = document.getElementById("btn-copy-result");
  const grammarCorrectionsList = document.getElementById("grammar-corrections-list");
  const optimizeResultsContainer = document.getElementById("optimize-results");

  // Dashboard Tab — detected article
  const detectedArticleCard = document.getElementById("detected-article-card");
  const detectedArticleTitle = document.getElementById("detected-article-title");
  const detectedArticleSource = document.getElementById("detected-article-source");
  const btnUseDetectedArticle = document.getElementById("btn-use-detected-article");

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

  // Account Tab
  const accountStrip = document.getElementById("account-strip");
  const accountAvatar = document.getElementById("account-avatar");
  const accountStripEmail = document.getElementById("account-strip-email");
  const accountSignedIn = document.getElementById("account-signed-in");
  const accountSignedOut = document.getElementById("account-signed-out");
  const accountAvatarLg = document.getElementById("account-avatar-lg");
  const accountCardEmail = document.getElementById("account-card-email");
  const btnSignOut = document.getElementById("btn-sign-out");
  const btnAuthModeLogin = document.getElementById("btn-auth-mode-login");
  const btnAuthModeSignup = document.getElementById("btn-auth-mode-signup");
  const authError = document.getElementById("auth-error");
  const formAuth = document.getElementById("form-auth");
  const fieldFullName = document.getElementById("field-full-name");
  const inputFullName = document.getElementById("input-full-name");
  const inputEmail = document.getElementById("input-email");
  const inputPassword = document.getElementById("input-password");
  const btnAuthSubmit = document.getElementById("btn-auth-submit");
  const btnGoogleSignin = document.getElementById("btn-google-signin");

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

  // ── Message dispatch. In the real extension this always goes through
  // background.js (the only context with a CORS exemption for the API
  // host). Outside the extension (a direct HTML preview) it falls back to
  // fetching straight from the page and a localStorage-backed session, so
  // the popup never crashes when opened as a plain file — Google Sign-In is
  // the one thing that structurally cannot work there. ──
  const sendMessage = (message, callback) => {
    if (isExtensionContext && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(message, callback);
      return;
    }

    const apiHost = extensionSettings.apiHost || "https://sinhalajournalllm.onrender.com/api/v1";

    if (message.action === "getSession") {
      const token = localStorage.getItem("sinai_preview_access_token");
      let user = null;
      if (token) {
        try {
          user = JSON.parse(localStorage.getItem("sinai_preview_user") || "null");
        } catch {
          user = null;
        }
      }
      callback({ success: true, data: { user } });
      return;
    }

    if (message.action === "logout") {
      localStorage.removeItem("sinai_preview_access_token");
      localStorage.removeItem("sinai_preview_user");
      callback({ success: true });
      return;
    }

    if (message.action === "googleAuth") {
      callback({ success: false, error: "Google sign-in requires the installed extension." });
      return;
    }

    if (message.action === "login" || message.action === "signup") {
      const path = message.action === "login" ? "/auth/login" : "/auth/signup";
      const payload =
        message.action === "login"
          ? { email: message.email, password: message.password }
          : { email: message.email, password: message.password, full_name: message.fullName || null };

      fetch(`${apiHost}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
          return data;
        })
        .then((data) => {
          localStorage.setItem("sinai_preview_access_token", data.access_token);
          localStorage.setItem("sinai_preview_user", JSON.stringify(data.user));
          callback({ success: true, data: { user: data.user } });
        })
        .catch((err) => callback({ success: false, error: err.message }));
      return;
    }

    // Fallback: Direct API request if previewed as standard page
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
  };

  /**
   * Open a stream for POST /optimize. `onEvent` fires once per NDJSON
   * object; `onDone`/`onError` fire exactly once, at the end.
   *
   * Real extension: a long-lived Port to background.js, which does the
   * actual fetch (only it gets a CORS exemption via host_permissions).
   * Preview fallback: fetch directly, reusing the same NDJSON line-buffering
   * web-app's services/api.js uses (a chunk boundary can land mid-line and
   * mid-UTF-8-sequence — Sinhala is 3 bytes/char).
   */
  function openOptimizeStream(body, onEvent, onDone, onError) {
    if (isExtensionContext && chrome.runtime && chrome.runtime.connect) {
      const port = chrome.runtime.connect({ name: "optimizeStream" });
      let finished = false;

      port.onMessage.addListener((message) => {
        if (message.type === "event") {
          onEvent(message.data);
        } else if (message.type === "done") {
          finished = true;
          onDone();
        } else if (message.type === "error") {
          finished = true;
          onError(message.error);
        }
        // "heartbeat" needs no handling — it only exists to keep the
        // service worker alive while a stage is still running.
      });

      port.onDisconnect.addListener(() => {
        if (!finished) {
          finished = true;
          onError("Connection to the extension background was lost.");
        }
      });

      port.postMessage({ action: "startOptimize", body });
      return {
        close: () => {
          try {
            port.disconnect();
          } catch {}
        }
      };
    }

    const apiHost = extensionSettings.apiHost || "https://sinhalajournalllm.onrender.com/api/v1";
    const controller = new AbortController();

    fetch(`${apiHost}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const drain = (flush) => {
          const lines = buffer.split("\n");
          buffer = flush ? "" : lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) onEvent(JSON.parse(trimmed));
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          drain(false);
        }
        buffer += decoder.decode();
        drain(true);
        onDone();
      })
      .catch((err) => {
        if (err.name !== "AbortError") onError(err.message);
      });

    return { close: () => controller.abort() };
  }

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
    apiHost: "https://sinhalajournalllm.onrender.com/api/v1",
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
  // Grammar and headlines always run in Optimize; these two are opt-in
  // extra stages, matching the web app's Optimize Article behavior.
  let optimizeState = {
    restyle: false,
    summarize: false,
    tone: "formal",
    length: "medium"
  };
  let detectedArticle = null; // { text, title, hostname }
  let currentUser = null; // { id, email, ... } | null
  let authMode = "login"; // "login" | "signup"

  // How old an in-progress run can be before the restore-on-open logic gives
  // up waiting on it and treats it as abandoned, rather than showing "still
  // processing" forever if background.js never got to write a final result
  // (e.g. the service worker itself was killed mid-run).
  const RUN_STALE_MS = 5 * 60 * 1000;

  // Matches the web app's per-tool action labels and the content-script
  // card — "Run" told the user nothing about what was about to happen.
  const TOOL_RUN_LABEL = {
    grammar: "Correct",
    headlines: "Generate",
    rewriter: "Rewrite",
    summarizer: "Summarize",
    optimize: "Optimize"
  };

  // ── Initialize App ──
  loadSettingsAndData();
  setupNavigation();
  setupToolEvents();
  setupSettingsEvents();
  setupHistoryEvents();
  setupAccountEvents();
  checkApiHealth();
  fetchPageArticle();
  refreshSession();
  setupPersistedRunSync();
  restoreRunState();

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
        } else if (targetPanelId === "panel-account") {
          refreshSession();
        }
      });
    });
  }

  // ── Detected Article (active tab) ──
  // Asks the content script what article (if any) it extracted from the
  // current page, so the popup can offer to run tools on it directly
  // instead of the user having to copy/paste text in manually.
  function fetchPageArticle() {
    if (!isExtensionContext || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;

      chrome.tabs.sendMessage(tab.id, { action: "getPageArticle" }, (response) => {
        // No content script on this tab (chrome:// pages, PDFs, a tab open
        // before the extension was installed, etc.) — nothing to show.
        if (chrome.runtime.lastError || !response || !response.success || !response.article) return;

        detectedArticle = {
          text: response.article.text,
          title: response.article.title,
          hostname: response.hostname
        };
        detectedArticleTitle.textContent = detectedArticle.title;
        detectedArticleSource.textContent = detectedArticle.hostname;
        detectedArticleCard.classList.remove("hidden");
      });
    });
  }

  btnUseDetectedArticle.addEventListener("click", () => {
    if (!detectedArticle) return;
    document.querySelector(".nav-item[data-target='panel-tools']").click();
    toolTextareaInput.value = detectedArticle.text;
    toolTextareaInput.dispatchEvent(new Event("input"));
    toolTextareaInput.focus();
  });

  // ── Account / Auth ──
  function refreshSession() {
    sendMessage({ action: "getSession" }, (response) => {
      currentUser = response && response.success ? response.data.user : null;
      applyAccountUI();
    });
  }

  function applyAccountUI() {
    if (currentUser) {
      const initial = (currentUser.email || "?").charAt(0);
      accountAvatar.textContent = initial;
      accountAvatarLg.textContent = initial;
      accountStripEmail.textContent = currentUser.email;
      accountCardEmail.textContent = currentUser.email;
      accountStrip.classList.remove("hidden");
      accountSignedIn.classList.remove("hidden");
      accountSignedOut.classList.add("hidden");
    } else {
      accountStrip.classList.add("hidden");
      accountSignedIn.classList.add("hidden");
      accountSignedOut.classList.remove("hidden");
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    btnAuthModeLogin.classList.toggle("active", mode === "login");
    btnAuthModeSignup.classList.toggle("active", mode === "signup");
    fieldFullName.classList.toggle("hidden", mode !== "signup");
    inputPassword.setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password");
    btnAuthSubmit.textContent = mode === "signup" ? "Create Account" : "Sign In";
    authError.classList.add("hidden");
  }

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove("hidden");
  }

  function refreshDashboardAndHistoryFromServer() {
    updateDashboardStats();
    renderHistoryList();
  }

  function setupAccountEvents() {
    accountStrip.addEventListener("click", () => {
      document.querySelector(".nav-item[data-target='panel-account']").click();
    });

    btnAuthModeLogin.addEventListener("click", () => setAuthMode("login"));
    btnAuthModeSignup.addEventListener("click", () => setAuthMode("signup"));

    formAuth.addEventListener("submit", (e) => {
      e.preventDefault();
      authError.classList.add("hidden");

      const email = inputEmail.value.trim();
      const password = inputPassword.value;
      if (!email || !password) return;

      btnAuthSubmit.disabled = true;
      btnAuthSubmit.classList.add("loading");

      const message =
        authMode === "signup"
          ? { action: "signup", email, password, fullName: inputFullName.value.trim() }
          : { action: "login", email, password };

      sendMessage(message, (response) => {
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.classList.remove("loading");

        if (!response || !response.success) {
          showAuthError(response ? response.error : "Could not connect to server.");
          return;
        }

        formAuth.reset();
        currentUser = response.data.user;
        applyAccountUI();
        refreshDashboardAndHistoryFromServer();
      });
    });

    btnGoogleSignin.addEventListener("click", () => {
      authError.classList.add("hidden");
      btnGoogleSignin.disabled = true;
      const originalHtml = btnGoogleSignin.innerHTML;
      btnGoogleSignin.textContent = "Opening Google sign-in…";

      sendMessage({ action: "googleAuth" }, (response) => {
        btnGoogleSignin.disabled = false;
        btnGoogleSignin.innerHTML = originalHtml;

        if (!response || !response.success) {
          showAuthError(response ? response.error : "Google sign-in failed.");
          return;
        }

        currentUser = response.data.user;
        applyAccountUI();
        refreshDashboardAndHistoryFromServer();
      });
    });

    btnSignOut.addEventListener("click", () => {
      sendMessage({ action: "logout" }, () => {
        currentUser = null;
        applyAccountUI();
        renderHistoryList();
        updateDashboardStats();
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
        apiHost: inputApiHost.value.trim() || "https://sinhalajournalllm.onrender.com/api/v1",
        defaultTone: selectDefaultTone.value,
        defaultLength: selectDefaultLength.value,
        defaultHeadlineCount: parseInt(inputDefaultHeadlines.value, 10) || 5
      };

      storage.set(updated, () => {
        extensionSettings = { ...extensionSettings, ...updated };

        // Show success visual feedback on button
        const originalText = btnSaveSettings.textContent;
        btnSaveSettings.textContent = "Saved!";
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
      toolOptionsOptimize.classList.add("hidden");

      // Show the selected options panel
      if (tool === "rewriter") {
        toolOptionsStyleRewriter.classList.remove("hidden");
        toolTextareaInput.placeholder = "Paste the Sinhala text you want to rewrite...";
      } else if (tool === "summarizer") {
        toolOptionsSummarizer.classList.remove("hidden");
        toolTextareaInput.placeholder = "Paste the long Sinhala article you want to summarize...";
      } else if (tool === "headlines") {
        toolTextareaInput.placeholder = "Paste the news article to generate headlines from...";
      } else if (tool === "optimize") {
        toolOptionsOptimize.classList.remove("hidden");
        toolTextareaInput.placeholder = "Paste the full article here...";
      } else {
        toolTextareaInput.placeholder = "Paste your Sinhala sentence here...";
      }

      // Button reflects what it's actually about to do, not a generic "Run".
      btnProcessTool.textContent = TOOL_RUN_LABEL[tool] || "Run";

      // Hide previous result when switching tools
      toolResultContainer.classList.add("hidden");
      optimizeResultsContainer.classList.add("hidden");
      toolResultOutput.classList.remove("hidden");
    });

    // Optimize toggles
    optimizeToggleRestyle.addEventListener("change", (e) => {
      optimizeState.restyle = e.target.checked;
      optimizeToneControl.classList.toggle("hidden", !e.target.checked);
    });
    optimizeToggleSummarize.addEventListener("change", (e) => {
      optimizeState.summarize = e.target.checked;
      optimizeLengthControl.classList.toggle("hidden", !e.target.checked);
    });
    optimizeToneControl.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        optimizeToneControl.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        optimizeState.tone = btn.getAttribute("data-value");
      });
    });
    optimizeLengthControl.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        optimizeLengthControl.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        optimizeState.length = btn.getAttribute("data-value");
      });
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

      if (activeToolState.tool === "optimize") {
        runOptimizeInPopup(inputVal);
        return;
      }

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

      setToolProcessingUI(true);

      // In the real extension, background.js runs this to completion and
      // persists the result regardless of whether the popup is still open —
      // a browser_action popup is destroyed on every blur (switching tabs
      // closes it entirely), so this callback firing is a nice-to-have, not
      // the source of truth. chrome.storage.onChanged (setupPersistedRunSync
      // below) is what actually renders the result, whether the popup
      // stayed open or was closed and reopened mid-run.
      if (isExtensionContext && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "runTool", tool: activeToolState.tool, endpoint, body }, () => {});
        return;
      }

      // Preview fallback — no popup-lifetime concerns outside the extension.
      sendMessage({ action: "callApi", endpoint, body, method: "POST" }, (response) => {
        setToolProcessingUI(false);
        if (!response || !response.success) {
          showError(response ? response.error : "Failed to connect to server.");
          return;
        }
        renderToolResult(activeToolState.tool, response.data);
        scrollToResult();
      });
    });
  }

  function setToolProcessingUI(isProcessing) {
    btnProcessTool.disabled = isProcessing || toolTextareaInput.value.trim().length === 0;
    btnProcessTool.classList.toggle("loading", isProcessing);
    if (isProcessing) {
      toolResultContainer.classList.add("hidden");
      grammarCorrectionsList.classList.add("hidden");
    }
  }

  function scrollToResult() {
    toolResultContainer.classList.remove("hidden");
    requestAnimationFrame(() => {
      toolResultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  /** Renders a persisted single-tool run — used both for a live completion
   *  (via chrome.storage.onChanged) and for restoring one on popup reopen. */
  function applySingleToolResult(result) {
    if (!result) return;
    if (activeToolState.tool !== result.tool) {
      selectActiveTool.value = result.tool;
      selectActiveTool.dispatchEvent(new Event("change"));
    }
    toolTextareaInput.value = result.input;
    toolTextareaInput.dispatchEvent(new Event("input"));
    setToolProcessingUI(false);

    if (result.error) {
      showError(result.error);
    } else {
      renderToolResult(result.tool, result.data);
    }

    const toolsNav = document.querySelector(".nav-item[data-target='panel-tools']");
    if (toolsNav && !toolsNav.classList.contains("active")) toolsNav.click();
    scrollToResult();
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

        // Mirrors the inline card: the substitution guard flags edits that
        // look like a swapped word rather than a fixed spelling, and a
        // renamed person has to be visible before the user copies the text
        // out. Banner first so it survives scrolling.
        const flagged = data.corrections.filter((c) => c.suspicious);
        if (flagged.length > 0) {
          const warn = document.createElement("div");
          warn.className = "correction-warning-banner";
          warn.textContent =
            flagged.length === 1
              ? "1 change may have replaced a word — check it below before using this text."
              : `${flagged.length} changes may have replaced words — check them below before using this text.`;
          grammarCorrectionsList.appendChild(warn);
        }

        data.corrections.forEach((c) => {
          const detailItem = document.createElement("div");
          detailItem.className = c.suspicious
            ? "correction-detail-item is-flagged"
            : "correction-detail-item";
          detailItem.innerHTML = `
            <div class="correction-comparison">
              <span class="corr-orig">${escapeHtml(c.original)}</span>
              <span class="corr-arrow">➔</span>
              <span class="corr-new">${escapeHtml(c.corrected)}</span>
            </div>
            <div class="correction-rule">${escapeHtml(
              c.suspicious
                ? c.suspicious_reason || "Possible word replacement — verify against your source."
                : c.rule
            )}</div>
          `;
          grammarCorrectionsList.appendChild(detailItem);
        });
      } else {
        grammarCorrectionsList.classList.remove("hidden");
        grammarCorrectionsList.innerHTML = `<div class="empty-state" style="padding: 10px 0;"><p style="color: #10B981; font-size: 0.8rem;">No grammar issues found.</p></div>`;
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
    toolResultOutput.classList.remove("hidden");
    optimizeResultsContainer.classList.add("hidden");
    toolResultOutput.innerHTML = `<span style="color: #EF4444; font-weight: 500;">ERROR: ${escapeHtml(msg)}</span><br><span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; display: block;">Check that the API service is running and review your Settings.</span>`;
  }

  // ── Optimize: real streaming pipeline via POST /optimize ──
  // One backend call, streamed as NDJSON — see background.js's
  // "optimizeStream" Port handler. Replaces the old client-side chain of
  // four separate tool calls: that predated /optimize existing and could
  // drift from the server's own pipeline ordering/validation.
  const OPTIMIZE_STAGE_LABEL = { grammar: "Grammar", style: "Style", headline: "Headlines", summary: "Summary" };

  function optimizeStageList() {
    const stages = ["grammar"];
    if (optimizeState.restyle) stages.push("style");
    stages.push("headline");
    if (optimizeState.summarize) stages.push("summary");
    return stages;
  }

  function renderOptimizeSkeleton(stages) {
    toolResultContainer.classList.remove("hidden");
    toolResultOutput.classList.add("hidden");
    grammarCorrectionsList.classList.add("hidden");
    optimizeResultsContainer.classList.remove("hidden");
    optimizeResultsContainer.innerHTML = stages
      .map(
        (id) => `
        <div class="optimize-stage-card" data-stage="${id}">
          <div class="optimize-stage-card-head">
            ${OPTIMIZE_STAGE_LABEL[id]}
            <span class="optimize-stage-card-status pending" data-role="status">Queued</span>
          </div>
          <div class="optimize-stage-card-body" data-role="body"></div>
        </div>
      `
      )
      .join("");
  }

  function setOptimizeStageStatus(id, status) {
    const statusEl = optimizeResultsContainer.querySelector(`.optimize-stage-card[data-stage="${id}"] [data-role="status"]`);
    if (!statusEl) return;
    statusEl.className = `optimize-stage-card-status ${status}`;
    statusEl.textContent =
      status === "running" ? "Running" :
      status === "done" ? "Done" :
      status === "failed" ? "Failed" :
      status === "skipped" ? "Skipped" : "Queued";
    const bodyEl = optimizeResultsContainer.querySelector(`.optimize-stage-card[data-stage="${id}"] [data-role="body"]`);
    if (status === "running" && bodyEl) {
      bodyEl.innerHTML = `<div class="optimize-shimmer-line" style="width:88%"></div><div class="optimize-shimmer-line" style="width:65%"></div>`;
    }
  }

  function setOptimizeStageResult(id, text, isError) {
    const bodyEl = optimizeResultsContainer.querySelector(`.optimize-stage-card[data-stage="${id}"] [data-role="body"]`);
    if (!bodyEl) return;
    bodyEl.textContent = text;
    bodyEl.style.color = isError ? "var(--accent-hover)" : "";
  }

  /** Pulls the field each stage's own response shape carries the result in. */
  function optimizeStageText(stage, data) {
    if (!data) return "";
    if (stage === "grammar") return data.corrected || "";
    if (stage === "style") return data.rewritten || "";
    if (stage === "headline") return (data.headlines || []).map((h, i) => `${i + 1}. ${h}`).join("\n");
    if (stage === "summary") return data.summary || "";
    return "";
  }

  function runOptimizeInPopup(inputVal) {
    const body = {
      text: inputVal,
      restyle: optimizeState.restyle,
      tone: optimizeState.tone,
      summarize: optimizeState.summarize,
      length: optimizeState.length,
      headline_count: extensionSettings.defaultHeadlineCount,
      headline_category: "General",
      headline_length: "medium"
    };

    renderOptimizeSkeleton(optimizeStageList());
    btnProcessTool.disabled = true;
    btnProcessTool.classList.add("loading");
    scrollToResult();

    // Real extension: background.js runs the whole pipeline and persists
    // progress to chrome.storage.local as each stage lands — see the big
    // comment on setupPersistedRunSync below for why (a popup is destroyed
    // on every blur, unlike content.js's inline card).
    if (isExtensionContext && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "runOptimizeTracked", body }, () => {});
      return;
    }

    // Preview fallback — direct stream, no popup-lifetime concerns outside
    // the extension.
    const stages = optimizeStageList();
    let finalText = inputVal;
    const seenStages = new Set();

    openOptimizeStream(
      body,
      (event) => {
        if (event.stage === "pipeline") {
          if (event.status === "done" && event.data) {
            finalText = event.data.final_text || finalText;
          }
          return;
        }

        seenStages.add(event.stage);

        if (event.status === "running") {
          setOptimizeStageStatus(event.stage, "running");
        } else if (event.status === "done") {
          setOptimizeStageStatus(event.stage, "done");
          setOptimizeStageResult(event.stage, optimizeStageText(event.stage, event.data));
        } else if (event.status === "skipped") {
          setOptimizeStageStatus(event.stage, "skipped");
          setOptimizeStageResult(
            event.stage,
            event.reason === "disabled" ? "This tool is currently switched off." : "Skipped."
          );
        } else if (event.status === "failed") {
          setOptimizeStageStatus(event.stage, "failed");
          setOptimizeStageResult(event.stage, event.error || "This stage failed.", true);
        }
      },
      () => {
        btnProcessTool.disabled = false;
        btnProcessTool.classList.remove("loading");
        toolResultOutput.textContent = finalText;
        scrollToResult();
      },
      (errorMessage) => {
        btnProcessTool.disabled = false;
        btnProcessTool.classList.remove("loading");
        stages.forEach((id) => {
          if (!seenStages.has(id)) {
            setOptimizeStageStatus(id, "failed");
            setOptimizeStageResult(id, errorMessage, true);
          }
        });
      }
    );
  }

  /** Renders a persisted Optimize run's full state — used both for live
   *  progress (via chrome.storage.onChanged) and for restoring one on popup
   *  reopen, so the two cases share one rendering path. */
  function applyOptimizeState(run) {
    if (!run) return;

    if (activeToolState.tool !== "optimize") {
      selectActiveTool.value = "optimize";
      selectActiveTool.dispatchEvent(new Event("change"));
    }
    toolTextareaInput.value = run.input;
    toolTextareaInput.dispatchEvent(new Event("input"));

    renderOptimizeSkeleton(run.stageIds);
    run.stageIds.forEach((id) => {
      const stage = run.stages[id];
      if (!stage || stage.status === "pending") return; // skeleton already shows "Queued"

      setOptimizeStageStatus(id, stage.status);
      if (stage.status === "done") {
        setOptimizeStageResult(id, optimizeStageText(id, stage.data));
      } else if (stage.status === "skipped") {
        setOptimizeStageResult(id, stage.reason === "disabled" ? "This tool is currently switched off." : "Skipped.");
      } else if (stage.status === "failed") {
        setOptimizeStageResult(id, stage.error || "This stage failed.", true);
      }
    });

    if (!run.done) {
      btnProcessTool.disabled = true;
      btnProcessTool.classList.add("loading");
      return;
    }

    btnProcessTool.disabled = false;
    btnProcessTool.classList.remove("loading");
    toolResultOutput.textContent = run.finalText || run.input;

    if (run.error) {
      // A pipeline-level failure, not a single stage — surface it on
      // whatever stages never got to report their own outcome.
      run.stageIds.forEach((id) => {
        const stage = run.stages[id];
        if (!stage || stage.status === "pending" || stage.status === "running") {
          setOptimizeStageStatus(id, "failed");
          setOptimizeStageResult(id, run.error, true);
        }
      });
    }

    const toolsNav = document.querySelector(".nav-item[data-target='panel-tools']");
    if (toolsNav && !toolsNav.classList.contains("active")) toolsNav.click();
    scrollToResult();
  }

  // ── Persisted-run sync: source of truth is chrome.storage.local ──
  // A browser_action popup is destroyed on every blur (switching tabs closes
  // it entirely, not just backgrounds it), so anything only held in this
  // script's memory is gone the instant the user looks away mid-run.
  // background.js keeps executing regardless and writes progress/results to
  // storage; this listener renders them live whenever this popup instance
  // happens to be open, and restoreRunState() (below) covers the case where
  // it wasn't.
  function setupPersistedRunSync() {
    if (!isExtensionContext || !chrome.storage || !chrome.storage.onChanged) return;

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      if (changes.sinai_active_run && changes.sinai_active_run.newValue) {
        const active = changes.sinai_active_run.newValue;
        if (activeToolState.tool !== active.tool) {
          selectActiveTool.value = active.tool;
          selectActiveTool.dispatchEvent(new Event("change"));
        }
        toolTextareaInput.value = active.input;
        toolTextareaInput.dispatchEvent(new Event("input"));
        setToolProcessingUI(true);
      }

      if (changes.sinai_last_result && changes.sinai_last_result.newValue) {
        applySingleToolResult(changes.sinai_last_result.newValue);
      }

      if (changes.sinai_optimize_run && changes.sinai_optimize_run.newValue) {
        applyOptimizeState(changes.sinai_optimize_run.newValue);
      }
    });
  }

  /** Restores whatever the last (or still in-flight) run was when this
   *  popup instance opens — covers both "reopened after it finished" and
   *  "reopened while it's still running". */
  function restoreRunState() {
    if (!isExtensionContext) return;

    storage.get(["sinai_active_run", "sinai_last_result", "sinai_optimize_run"], (data) => {
      const { sinai_active_run, sinai_last_result, sinai_optimize_run } = data;

      if (sinai_optimize_run) {
        const stillRunning = !sinai_optimize_run.done;
        const stale = stillRunning && Date.now() - sinai_optimize_run.startedAt > RUN_STALE_MS;
        if (!stale) {
          applyOptimizeState(sinai_optimize_run);
          return;
        }
      }

      const activeIsCurrent =
        sinai_active_run && (!sinai_last_result || sinai_last_result.runId !== sinai_active_run.runId);
      const activeIsStale =
        sinai_active_run && Date.now() - sinai_active_run.startedAt > RUN_STALE_MS;

      if (activeIsCurrent && !activeIsStale) {
        if (activeToolState.tool !== sinai_active_run.tool) {
          selectActiveTool.value = sinai_active_run.tool;
          selectActiveTool.dispatchEvent(new Event("change"));
        }
        toolTextareaInput.value = sinai_active_run.input;
        toolTextareaInput.dispatchEvent(new Event("input"));
        setToolProcessingUI(true);
        return;
      }

      if (sinai_last_result) {
        applySingleToolResult(sinai_last_result);
      }
    });
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
    if (currentUser) {
      sendMessage({ action: "callApi", endpoint: "/history?limit=50", method: "GET" }, (response) => {
        if (response && response.success) {
          const normalized = (response.data.items || []).map((item) => ({
            id: item.id,
            type: item.tool,
            timestamp: item.created_at,
            original: item.input_preview,
            result: item.output_preview
          }));
          renderHistoryCards(normalized, false);
        } else {
          // Offline/failed — fall back to the local mirror rather than an empty list.
          storage.get(["history"], (data) => renderHistoryCards(data.history || [], true));
        }
      });
      return;
    }
    storage.get(["history"], (data) => renderHistoryCards(data.history || [], true));
  }

  /** `clickable`: local items carry full (untruncated) original text and can be
   *  re-opened in the editor; server items are truncated previews and are not. */
  function renderHistoryCards(list, clickable) {
    historyItemsContainer.innerHTML = "";

    if (list.length === 0) {
      historyItemsContainer.innerHTML = `
        <div class="empty-state">
          <p>No recent activity.</p>
        </div>
      `;
      return;
    }

    list.forEach((item) => {
      const card = document.createElement("div");
      card.className = clickable ? "history-card is-clickable" : "history-card";

      let typeLabel = "Grammar";
      if (item.type === "headlines") typeLabel = "Headlines";
      if (item.type === "rewriter") typeLabel = "Rewriter";
      if (item.type === "summarizer") typeLabel = "Summarizer";
      if (item.type === "optimize") typeLabel = "Optimize";

      const timeString = formatTime(item.timestamp);

      card.innerHTML = `
        <div class="history-card-header">
          <span class="history-badge ${item.type}">${typeLabel}</span>
          <span class="history-time">${timeString}</span>
        </div>
        <div class="history-snippet" title="${escapeHtml(item.original || "")}">Original: ${escapeHtml(item.original || "")}</div>
        <div class="history-result" title="${escapeHtml(item.result || "")}">Result: ${escapeHtml(item.result || "")}</div>
      `;

      if (clickable) {
        card.addEventListener("click", () => {
          selectActiveTool.value = item.type;
          selectActiveTool.dispatchEvent(new Event("change"));
          toolTextareaInput.value = item.original;
          toolTextareaInput.dispatchEvent(new Event("input"));
          document.querySelector(".nav-item[data-target='panel-tools']").click();
        });
      }

      historyItemsContainer.appendChild(card);
    });
  }

  // ── Dashboard Stats ──
  function updateDashboardStats(historyCache) {
    if (currentUser) {
      sendMessage({ action: "callApi", endpoint: "/history/stats", method: "GET" }, (response) => {
        if (response && response.success) {
          statTotalChecks.textContent = response.data.total || 0;
          statToolsUsed.textContent = Object.keys(response.data.per_tool || {}).length;
        } else {
          applyLocalStats();
        }
      });
      return;
    }
    applyLocalStats();

    function applyLocalStats() {
      if (historyCache) {
        applyStats(historyCache);
      } else {
        storage.get(["history"], (data) => {
          applyStats(data.history || []);
        });
      }
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
