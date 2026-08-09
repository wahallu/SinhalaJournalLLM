/**
 * SinAI Chrome Extension Background Service Worker
 * Bypasses host site CSPs via background API requests, handles context
 * menus, owns the auth session, and proxies the streaming /optimize
 * endpoint over a long-lived Port (a one-shot sendResponse can't deliver a
 * live NDJSON stream to the popup or content script).
 */

const DEFAULT_SETTINGS = {
  apiHost: "https://sinhalajournalllm.onrender.com/api/v1",
  inlineEnabled: true,
  defaultTone: "formal",
  defaultLength: "medium",
  defaultHeadlineCount: 5
};

// Must match the backend's GOOGLE_CLIENT_ID (apps/backend-api/.env) and the
// web app's VITE_GOOGLE_CLIENT_ID. Not secret — every client embeds the same
// value so the ID token's audience matches what the backend checks.
const GOOGLE_CLIENT_ID = "842434243630-97ui4d8e93bn3ut6csgnk9986fqrl2n9.apps.googleusercontent.com";

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

// ── Promisified storage helpers ──
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}
function storageRemove(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

async function getApiHost() {
  const { apiHost } = await storageGet(["apiHost"]);
  let host = apiHost || DEFAULT_SETTINGS.apiHost;
  if (host.endsWith("/")) host = host.slice(0, -1);
  return host;
}

// ── Auth session store ──
// Read fresh from chrome.storage.local on every request rather than cached
// in a module-level variable: MV3 service workers are evicted and respawned
// routinely (as often as every ~30s idle), which would silently reset any
// in-memory cache. storage.local is the only state that actually survives.
const SESSION_KEYS = ["sinai_access_token", "sinai_refresh_token", "sinai_user"];

async function getSession() {
  const items = await storageGet(SESSION_KEYS);
  if (!items.sinai_access_token || !items.sinai_user) return null;
  return {
    accessToken: items.sinai_access_token,
    refreshToken: items.sinai_refresh_token || null,
    user: items.sinai_user
  };
}

async function storeSession({ access_token, refresh_token, user }) {
  const update = {};
  if (access_token) update.sinai_access_token = access_token;
  if (refresh_token) update.sinai_refresh_token = refresh_token;
  if (user) update.sinai_user = user;
  await storageSet(update);
}

async function clearSession() {
  await storageRemove(SESSION_KEYS);
}

/** One POST to an /auth/* endpoint. Throws with the backend's own message on failure. */
async function authFetch(path, body) {
  const apiHost = await getApiHost();
  const res = await fetch(`${apiHost}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Request failed (${res.status})`);
  }
  return data;
}

/**
 * Exchange the stored refresh token for a new access token.
 * Returns null (and clears the session) when there is nothing to refresh or
 * the refresh token itself has expired — callers treat that as "signed
 * out", matching web-app's authClient.js.
 */
async function refreshAccessToken() {
  const session = await getSession();
  if (!session || !session.refreshToken) return null;
  try {
    const data = await authFetch("/auth/refresh", { refresh_token: session.refreshToken });
    await storeSession({ access_token: data.access_token });
    return data.access_token;
  } catch {
    await clearSession();
    return null;
  }
}

/**
 * One fetch, retried once behind a token refresh on 401. Centralized here so
 * popup.js and content.js never need to know a token exists, let alone how
 * to refresh one — they only ever see { success, data } or { success, error }.
 */
async function authenticatedFetch(url, options, session) {
  const send = (token) => {
    const headers = { ...options.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  let res = await send(session && session.accessToken);

  if (res.status === 401 && session && session.accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await send(refreshed);
  }

  return res;
}

// ── Google Sign-In ──
// Google Identity Services' normal <script>+button flow assumes a real page
// with a stable origin; a 420x570 popup that closes on blur can't host it.
// chrome.identity.launchWebAuthFlow runs the OAuth implicit flow instead —
// requesting response_type=id_token gets back an actual Google ID token
// (not just an opaque access token the way chrome.identity.getAuthToken
// would), which is what POST /auth/google requires. Run from background.js
// rather than popup.js: the OAuth window stealing focus can close the popup
// mid-flow, which would otherwise abandon an in-progress await.
async function googleSignIn() {
  const redirectUri = chrome.identity.getRedirectURL();
  const nonce = crypto.randomUUID();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("response_type", "id_token");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("prompt", "select_account");

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (redirectedTo) => {
        if (chrome.runtime.lastError || !redirectedTo) {
          reject(new Error(
            (chrome.runtime.lastError && chrome.runtime.lastError.message) ||
            "Google sign-in was cancelled."
          ));
          return;
        }
        resolve(redirectedTo);
      }
    );
  });

  // Google returns the token in the URL fragment: https://<id>.chromiumapp.org/#id_token=...&...
  const fragment = responseUrl.split("#")[1] || "";
  const idToken = new URLSearchParams(fragment).get("id_token");
  if (!idToken) throw new Error("Google did not return an ID token.");

  const data = await authFetch("/auth/google", { credential: idToken });
  await storeSession(data);
  return data.user;
}

// ── Tool-run persistence (popup only) ──
// A browser_action popup is destroyed on every blur — switching tabs closes
// it entirely, not just backgrounds it — so any state living only in
// popup.js's memory (including an in-flight request's eventual result) is
// lost the instant the user looks away mid-run. These keys make
// chrome.storage.local the source of truth instead: the run keeps executing
// here regardless of whether anything is listening, and popup.js reads back
// whatever the latest state is — on load, and live via
// chrome.storage.onChanged while it happens to be open.
//
// content.js's inline card does not need this: a content script's page
// survives a tab switch (only tab close/navigate/reload tears it down), so
// its existing Port-based stream (below) already behaves correctly there.

async function setActiveRun(run) {
  await storageSet({ sinai_active_run: run });
}

async function setLastResult(result) {
  await storageSet({ sinai_active_run: null, sinai_last_result: result });
}

async function getOptimizeRun(expectedRunId) {
  const { sinai_optimize_run } = await storageGet(["sinai_optimize_run"]);
  if (!sinai_optimize_run || sinai_optimize_run.runId !== expectedRunId) return null;
  return sinai_optimize_run;
}

function newRunId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Secure API Fetch Proxy, Auth & History Tracker ──
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

    (async () => {
      try {
        const apiHost = await getApiHost();
        const session = await getSession();
        const url = `${apiHost}${endpoint}`;
        const options = {
          method: method || "POST",
          headers: { "Content-Type": "application/json" }
        };
        if (body && method !== "GET") {
          options.body = JSON.stringify(body);
        }

        const res = await authenticatedFetch(url, options, session);

        if (!res.ok) {
          const errDetail = await res.json().catch(() => ({}));
          throw new Error(errDetail.detail || errDetail.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        sendResponse({ success: true, data });

        // Optionally save to local extension history — a harmless offline
        // mirror even when signed in, and the only record at all when not.
        saveToLocalHistory(endpoint, body, data);
      } catch (error) {
        console.error("SinAI Background API Fetch Error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Asynchronous sendResponse
  }

  if (message.action === "login") {
    (async () => {
      try {
        const data = await authFetch("/auth/login", {
          email: message.email,
          password: message.password
        });
        await storeSession(data);
        sendResponse({ success: true, data: { user: data.user } });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.action === "signup") {
    (async () => {
      try {
        const data = await authFetch("/auth/signup", {
          email: message.email,
          password: message.password,
          full_name: message.fullName || null
        });
        await storeSession(data);
        sendResponse({ success: true, data: { user: data.user } });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.action === "logout") {
    (async () => {
      await clearSession();
      sendResponse({ success: true });
    })();
    return true;
  }

  if (message.action === "getSession") {
    (async () => {
      const session = await getSession();
      sendResponse({ success: true, data: { user: session ? session.user : null } });
    })();
    return true;
  }

  if (message.action === "googleAuth") {
    (async () => {
      try {
        const user = await googleSignIn();
        sendResponse({ success: true, data: { user } });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // ── Persisted single-tool run (popup only — see comment above) ──
  if (message.action === "runTool") {
    const { tool, endpoint, body } = message;
    const runId = newRunId("run");

    (async () => {
      await setActiveRun({ runId, tool, input: body.text, startedAt: Date.now() });

      try {
        const apiHost = await getApiHost();
        const session = await getSession();
        const url = `${apiHost}${endpoint}`;
        const options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        };

        const res = await authenticatedFetch(url, options, session);

        if (!res.ok) {
          const errDetail = await res.json().catch(() => ({}));
          throw new Error(errDetail.detail || errDetail.message || `HTTP ${res.status}`);
        }
        const data = await res.json();

        await setLastResult({ runId, tool, input: body.text, data, timestamp: Date.now() });
        saveToLocalHistory(endpoint, body, data);
        sendResponse({ success: true, data });
      } catch (error) {
        await setLastResult({ runId, tool, input: body.text, error: error.message, timestamp: Date.now() });
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  // ── Persisted Optimize run (popup only — see comment above). Unlike the
  // Port-based "optimizeStream" below, this survives the popup closing:
  // progress is written to chrome.storage.local as each stage completes
  // rather than pushed down a connection that dies with the popup. ──
  if (message.action === "runOptimizeTracked") {
    const { body } = message;
    const runId = newRunId("opt");

    const stageIds = ["grammar"];
    if (body.restyle) stageIds.push("style");
    stageIds.push("headline");
    if (body.summarize) stageIds.push("summary");
    const stages = {};
    stageIds.forEach((id) => {
      stages[id] = { status: "pending" };
    });

    (async () => {
      await storageSet({
        sinai_optimize_run: {
          runId,
          input: body.text,
          stageIds,
          stages,
          finalText: null,
          done: false,
          error: null,
          startedAt: Date.now()
        }
      });

      try {
        const apiHost = await getApiHost();
        const session = await getSession();
        const res = await authenticatedFetch(
          `${apiHost}/optimize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          },
          session
        );

        if (!res.ok) {
          const errDetail = await res.json().catch(() => ({}));
          throw new Error(errDetail.detail || errDetail.message || `HTTP ${res.status}`);
        }

        let finalText = body.text;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = async (event) => {
          if (event.stage === "pipeline") {
            if (event.status === "done" && event.data) {
              finalText = event.data.final_text || finalText;
              saveOptimizeToLocalHistory(event.data.original_text, event.data.final_text);
            }
            return;
          }
          const current = await getOptimizeRun(runId);
          if (!current) return; // superseded by a newer run
          current.stages[event.stage] = {
            status: event.status,
            data: event.status === "done" ? event.data : undefined,
            error: event.status === "failed" ? event.error : undefined,
            reason: event.status === "skipped" ? event.reason : undefined
          };
          await storageSet({ sinai_optimize_run: current });
        };

        const drain = async (flush) => {
          const lines = buffer.split("\n");
          buffer = flush ? "" : lines.pop();
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) await applyEvent(JSON.parse(trimmed));
          }
        };

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            await drain(false);
          }
          buffer += decoder.decode();
          await drain(true);
        } finally {
          reader.releaseLock();
        }

        const finished = await getOptimizeRun(runId);
        if (finished) {
          finished.done = true;
          finished.finalText = finalText;
          await storageSet({ sinai_optimize_run: finished });
        }
        sendResponse({ success: true });
      } catch (error) {
        const current = await getOptimizeRun(runId);
        if (current) {
          current.done = true;
          current.error = error.message;
          await storageSet({ sinai_optimize_run: current });
        }
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }
});

// ── Streaming: POST /optimize ──
// A one-shot sendResponse can't deliver a live NDJSON stream, so the popup
// and content script open a long-lived Port named "optimizeStream" instead;
// this posts one message per event as it arrives.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "optimizeStream") return;

  const controller = new AbortController();
  let ended = false;

  port.onDisconnect.addListener(() => {
    ended = true;
    controller.abort();
  });

  const post = (msg) => {
    if (ended) return;
    try {
      port.postMessage(msg);
    } catch {
      ended = true;
    }
  };

  port.onMessage.addListener((message) => {
    if (message.action !== "startOptimize") return;
    runOptimizeStream(message.body, post, controller.signal).finally(() => {
      if (!ended) {
        ended = true;
        try {
          port.disconnect();
        } catch {}
      }
    });
  });
});

async function runOptimizeStream(body, post, signal) {
  let heartbeat;
  try {
    const apiHost = await getApiHost();
    const session = await getSession();
    const url = `${apiHost}/optimize`;
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    };

    const res = await authenticatedFetch(url, options, session);

    if (!res.ok) {
      const errDetail = await res.json().catch(() => ({}));
      throw new Error(errDetail.detail || errDetail.message || `HTTP ${res.status}`);
    }

    // Idle message traffic — not merely an open port — is what resets MV3's
    // ~30s service-worker idle timer, and a stalled sinllama call (up to
    // SINLLAMA_TIMEOUT_SECONDS, plus an openrouter/mock fallback chain) can
    // easily go longer than that between two real NDJSON lines.
    heartbeat = setInterval(() => post({ type: "heartbeat" }), 15000);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // A chunk boundary can land mid-line and mid-UTF-8-sequence — Sinhala is
    // three bytes per character, so a naive decode would corrupt text rather
    // than merely split it. `stream: true` holds partial sequences back.
    const drain = (flush = false) => {
      const lines = buffer.split("\n");
      buffer = flush ? "" : lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const event = JSON.parse(trimmed);
        post({ type: "event", data: event });

        // The closing pipeline event carries the whole run's result — mirror
        // it into local history the same way a single-tool call does, so an
        // anonymous Optimize run still shows up in the History tab.
        if (event.stage === "pipeline" && event.status === "done" && event.data) {
          saveOptimizeToLocalHistory(event.data.original_text, event.data.final_text);
        }
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        drain();
      }
      buffer += decoder.decode();
      drain(true);
    } finally {
      reader.releaseLock();
    }

    post({ type: "done" });
  } catch (error) {
    if (error.name !== "AbortError") {
      post({ type: "error", error: error.message || String(error) });
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

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

/** Same as saveToLocalHistory, but for a completed Optimize run (see runOptimizeStream). */
function saveOptimizeToLocalHistory(originalText, finalText) {
  chrome.storage.local.get(["history"], (data) => {
    const historyList = data.history || [];
    const newItem = {
      id: "hist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      type: "optimize",
      timestamp: new Date().toISOString(),
      original: originalText || "",
      result: finalText || ""
    };
    const updatedHistory = [newItem, ...historyList].slice(0, 50);
    chrome.storage.local.set({ history: updatedHistory });
  });
}
