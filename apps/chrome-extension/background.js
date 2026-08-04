/**
 * SinAI Chrome Extension Background Service Worker
 * Bypasses host site CSPs via background API requests and handles context menus.
 */

const DEFAULT_SETTINGS = {
  apiHost: "https://sinhalajournalllm.onrender.com/api/v1",
  inlineEnabled: true,
  defaultTone: "formal",
  defaultLength: "medium",
  defaultHeadlineCount: 5
};

// Legacy tone values from before the option lists were aligned with the
// styles the SinLlama adapter was actually trained on.
const LEGACY_TONE_MAP = {
  journalistic: "formal",
  casual: "youth",
  news: "formal",
  opinion: "editorial"
};

// Run migration check on startup to redirect old localhost/sslip.io hosts
// to Render and remap legacy tone values.
chrome.storage.local.get(["apiHost", "defaultTone"], (items) => {
  const updates = {};
  const oldHostPattern = /localhost:8000|sslip\.io/;
  if (items.apiHost && oldHostPattern.test(items.apiHost)) {
    updates.apiHost = DEFAULT_SETTINGS.apiHost;
  }
  if (items.defaultTone && LEGACY_TONE_MAP[items.defaultTone]) {
    updates.defaultTone = LEGACY_TONE_MAP[items.defaultTone];
  }
  if (Object.keys(updates).length > 0) {
    chrome.storage.local.set(updates);
  }
});

// ── Lifecycle Event: Installation ──
chrome.runtime.onInstalled.addListener(() => {
  // 1. Initialize default settings & migrate old ones
  chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (items) => {
    const updates = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (items[key] === undefined) {
        updates[key] = DEFAULT_SETTINGS[key];
      }
    }
    
    // Auto-migrate if pointing to old/dead hosts
    const oldHostPattern = /localhost:8000|sslip\.io/;
    if (items.apiHost && oldHostPattern.test(items.apiHost)) {
      updates.apiHost = DEFAULT_SETTINGS.apiHost;
    }

    // Remap legacy tone values to trained styles
    if (items.defaultTone && LEGACY_TONE_MAP[items.defaultTone]) {
      updates.defaultTone = LEGACY_TONE_MAP[items.defaultTone];
    }

    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });

  // 2. Setup Context Menus
  chrome.contextMenus.create({
    id: "sinai-parent",
    title: "SinAi Assistant",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "sinai-grammar",
    parentId: "sinai-parent",
    title: "Check Sinhala Grammar",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "sinai-headlines",
    parentId: "sinai-parent",
    title: "Generate Headlines",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "sinai-rewriter",
    parentId: "sinai-parent",
    title: "Rewrite Style",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "sinai-summarizer",
    parentId: "sinai-parent",
    title: "Summarize Text",
    contexts: ["selection"]
  });
});

// ── Handle Context Menu Clicks ──
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  let mode = "grammar";
  if (info.menuItemId === "sinai-headlines") mode = "headlines";
  if (info.menuItemId === "sinai-rewriter") mode = "rewriter";
  if (info.menuItemId === "sinai-summarizer") mode = "summarizer";

  // Send message to the active tab's content script to show the inline tooltip
  chrome.tabs.sendMessage(tab.id, {
    action: "triggerInlineAssistant",
    mode: mode,
    text: info.selectionText
  }).catch((err) => {
    console.warn("Could not communicate with content script. It might not be loaded yet.", err);
  });
});

// ── Secure API Fetch Proxy & History Tracker ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "preWarm") {
    chrome.storage.local.get(["apiHost"], (settings) => {
      let apiHost = settings.apiHost || DEFAULT_SETTINGS.apiHost;
      const healthUrl = apiHost.replace(/\/api\/v1\/?$/, "") + "/health";
      fetch(healthUrl, { method: "GET" }).catch(() => {});
    });
    return false; // Sync message channel close
  }

  if (message.action === "updateBadge") {
    chrome.action.setBadgeText({ text: message.text || "", tabId: sender.tab.id });
    if (message.text) {
      chrome.action.setBadgeBackgroundColor({ color: "#CD191A", tabId: sender.tab.id });
    }
    return false;
  }

  if (message.action === "callApi") {
    const { endpoint, body, method } = message;
    
    chrome.storage.local.get(["apiHost"], (settings) => {
      let apiHost = settings.apiHost || DEFAULT_SETTINGS.apiHost;
      if (apiHost.endsWith("/")) {
        apiHost = apiHost.slice(0, -1);
      }
      const url = `${apiHost}${endpoint}`;
      
      const fetchOptions = {
        method: method || "POST",
        headers: {
          "Content-Type": "application/json"
        }
      };
      
      if (body && method !== "GET") {
        fetchOptions.body = JSON.stringify(body);
      }

      fetch(url, fetchOptions)
        .then(async (response) => {
          if (!response.ok) {
            const errDetail = await response.json().catch(() => ({}));
            throw new Error(errDetail.detail || errDetail.message || `HTTP ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          sendResponse({ success: true, data });
          
          // Optionally save to local extension history
          saveToLocalHistory(endpoint, body, data);
        })
        .catch((error) => {
          console.error("SinAI Background API Fetch Error:", error);
          sendResponse({ success: false, error: error.message });
        });
    });
    
    // Return true to indicate asynchronous sendResponse
    return true;
  }
});

/**
 * Saves completed operations into Chrome local storage history list.
 */
function saveToLocalHistory(endpoint, requestBody, responseData) {
  let type = "grammar";
  let snippet = "";
  let resultSummary = "";

  if (endpoint.includes("/grammar/check")) {
    type = "grammar";
    snippet = requestBody.text;
    resultSummary = responseData.corrected;
  } else if (endpoint.includes("/headlines/generate")) {
    type = "headlines";
    snippet = requestBody.text;
    resultSummary = responseData.headlines.join(", ");
  } else if (endpoint.includes("/rewrite")) {
    type = "rewriter";
    snippet = requestBody.text;
    resultSummary = responseData.rewritten;
  } else if (endpoint.includes("/summarize")) {
    type = "summarizer";
    snippet = requestBody.text;
    resultSummary = responseData.summary;
  } else {
    return; // Don't log unknown endpoints
  }

  chrome.storage.local.get(["history"], (data) => {
    const historyList = data.history || [];
    const newItem = {
      id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type,
      timestamp: new Date().toISOString(),
      original: snippet,
      result: resultSummary
    };
    
    // Limit local history to 50 items
    const updatedHistory = [newItem, ...historyList].slice(0, 50);
    chrome.storage.local.set({ history: updatedHistory });
  });
}
