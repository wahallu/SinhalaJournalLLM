/**
 * SinAI Google Docs Add-on Server-Side Code
 * Handles Google Document DOM operations and proxies external API calls.
 */

var API_BASE_URL = "https://sinhalajournalllm.onrender.com/api/v1";

// ── Lifecycle Hook: Document Opened ──
function onOpen(e) {
  try {

    // Add-on menu (appears under Extensions -> Add-ons)
    DocumentApp.getUi()
      .createAddonMenu()
      .addItem("Open Assistant", "showSidebar")
      .addToUi();
  } catch (err) {
    Logger.log("UI context not available (normal in editor run): " + err.message);
  }
}

function onInstall(e) {
  onOpen(e);
}

// ── Render Sidebar ──
function showSidebar() {
  var template = HtmlService.createTemplateFromFile("Sidebar");
  var html = template.evaluate()
    .setTitle("SinAI Document Assistant")
    .setWidth(300);
  DocumentApp.getUi().showSidebar(html);
}

// Helper to include sub-HTML files (CSS/JS) inside the main Sidebar template
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Read Selected Text ──
function getSelectedText() {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (!selection) {
    return "";
  }

  var elements = selection.getSelectedElements();
  if (!elements || elements.length === 0) {
    return "";
  }

  var paragraphs = [];
  var currentBlockText = "";
  var currentBlockElem = null;

  for (var i = 0; i < elements.length; i++) {
    var rangeElement = elements[i];
    var rawElem = rangeElement.getElement();

    // Determine the block container (Paragraph, ListItem, etc.)
    var blockElem = rawElem;
    while (blockElem) {
      var elemType = blockElem.getType ? blockElem.getType() : null;
      if (elemType === DocumentApp.ElementType.PARAGRAPH ||
          elemType === DocumentApp.ElementType.LIST_ITEM ||
          elemType === DocumentApp.ElementType.TABLE_ROW ||
          elemType === DocumentApp.ElementType.HEADER_SECTION ||
          elemType === DocumentApp.ElementType.FOOTER_SECTION ||
          elemType === DocumentApp.ElementType.BODY_SECTION) {
        break;
      }
      if (!blockElem.getParent) break;
      blockElem = blockElem.getParent();
    }

    if (currentBlockElem !== null && blockElem !== currentBlockElem) {
      paragraphs.push(currentBlockText);
      currentBlockText = "";
    }
    currentBlockElem = blockElem;

    var fragment = "";
    if (rawElem.getType && rawElem.getType() === DocumentApp.ElementType.TEXT) {
      var textObj = rawElem.asText();
      var txt = textObj.getText();
      if (rangeElement.isPartial()) {
        var start = rangeElement.getStartOffset();
        var end = rangeElement.getEndOffsetInclusive();
        fragment = txt.substring(start, end + 1);
      } else {
        fragment = txt;
      }
    } else if (rawElem.editAsText) {
      var textObj = rawElem.editAsText();
      var txt = textObj.getText();
      if (rangeElement.isPartial()) {
        var start = rangeElement.getStartOffset();
        var end = rangeElement.getEndOffsetInclusive();
        fragment = txt.substring(start, end + 1);
      } else {
        fragment = txt;
      }
    }

    currentBlockText += fragment;
  }

  if (currentBlockText !== "") {
    paragraphs.push(currentBlockText);
  }

  return paragraphs.join("\n").trim();
}

// ── Replace Selected Text ──
function replaceSelectedText(newText) {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (!selection) {
    throw new Error("No text selected in the document.");
  }

  var elements = selection.getSelectedElements();
  if (!elements || elements.length === 0) {
    throw new Error("No text selected in the document.");
  }

  // Clear trailing elements in reverse order so character offsets in earlier elements stay intact
  for (var i = elements.length - 1; i >= 1; i--) {
    var el = elements[i];
    var raw = el.getElement();
    if (raw.editAsText) {
      var tObj = raw.editAsText();
      if (el.isPartial()) {
        tObj.deleteText(el.getStartOffset(), el.getEndOffsetInclusive());
      } else {
        var parent = raw.getParent ? raw.getParent() : null;
        if (parent && parent.removeChild && parent.getNumChildren && parent.getNumChildren() > 1) {
          try {
            parent.removeChild(raw);
          } catch (e) {
            tObj.setText("");
          }
        } else {
          tObj.setText("");
        }
      }
    }
  }

  // Replace or insert text into the first selected element
  var firstEl = elements[0];
  var firstRaw = firstEl.getElement();
  if (firstRaw.editAsText) {
    var firstText = firstRaw.editAsText();
    if (firstEl.isPartial()) {
      firstText.deleteText(firstEl.getStartOffset(), firstEl.getEndOffsetInclusive());
      firstText.insertText(firstEl.getStartOffset(), newText);
    } else {
      firstText.setText(newText);
    }
  }
}

// ── Insert Text at Cursor ──
function insertTextAtCursor(text) {
  var doc = DocumentApp.getActiveDocument();
  var cursor = doc.getCursor();

  if (cursor) {
    cursor.insertText(text);
  } else {
    // Fallback: Append a paragraph to the end of the body
    doc.getBody().appendParagraph(text);
  }
}

// ── Settings storage ──
function saveSettings(settings) {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.setProperties(settings);
}

function loadSettings() {
  var userProperties = PropertiesService.getUserProperties();
  var props = userProperties.getProperties();
  return {
    apiHost: API_BASE_URL,
    defaultTone: props.defaultTone || "formal",
    defaultLength: props.defaultLength || "medium",
    defaultHeadlineCount: parseInt(props.defaultHeadlineCount || "5", 10)
  };
}

// ─────────────────────────────────────────────────────────────────────────
// ── Auth ──
//
// Tokens live in PropertiesService.getUserProperties() alongside settings —
// scoped per (script project, effective Google user) by Apps Script itself,
// and never reach the sandboxed sidebar iframe's client-side JS at all,
// which is strictly more contained than browser storage would be.
//
// Google Sign-In is deliberately not offered here: Apps Script's HtmlService
// sidebar runs inside a per-script, Google-generated *.googleusercontent.com
// sandbox origin that is neither stable nor registrable, which structurally
// breaks Google Identity Services' origin handshake, and there is no
// redirect-capture API available to sidebar JS the way chrome.identity gives
// the extension. Email/password (plus "forgot password") is what's offered
// on this surface.
// ─────────────────────────────────────────────────────────────────────────

function _getStoredSession() {
  var userProperties = PropertiesService.getUserProperties();
  var accessToken = userProperties.getProperty("accessToken");
  var userJson = userProperties.getProperty("user");
  if (!accessToken || !userJson) return null;
  return {
    accessToken: accessToken,
    refreshToken: userProperties.getProperty("refreshToken") || null,
    user: JSON.parse(userJson)
  };
}

function _storeSession(sessionData) {
  var userProperties = PropertiesService.getUserProperties();
  var update = {};
  if (sessionData.access_token) update.accessToken = sessionData.access_token;
  if (sessionData.refresh_token) update.refreshToken = sessionData.refresh_token;
  if (sessionData.user) update.user = JSON.stringify(sessionData.user);
  userProperties.setProperties(update);
}

function _clearSession() {
  var userProperties = PropertiesService.getUserProperties();
  userProperties.deleteProperty("accessToken");
  userProperties.deleteProperty("refreshToken");
  userProperties.deleteProperty("user");
}

/** One POST to an /auth/* endpoint that must never carry a Bearer token
 *  (login, signup, forgot-password, and refresh itself). */
function _rawAuthPost(path, body) {
  var apiHost = API_BASE_URL;
  if (apiHost.substring(apiHost.length - 1) === "/") {
    apiHost = apiHost.substring(0, apiHost.length - 1);
  }
  var url = apiHost + path;
  var options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var text = response.getContentText();
    if (code >= 200 && code < 300) {
      return { success: true, data: JSON.parse(text) };
    }
    var errObj = {};
    try { errObj = JSON.parse(text); } catch (e) {}
    return { success: false, error: errObj.detail || errObj.message || ("HTTP " + code) };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Exchange the stored refresh token for a new access token.
 * Returns null (and clears the session) when there is nothing to refresh or
 * the refresh token itself has expired — mirrors web-app's authClient.js
 * and the extension's background.js.
 */
function _refreshAccessToken() {
  var session = _getStoredSession();
  if (!session || !session.refreshToken) return null;
  var result = _rawAuthPost("/auth/refresh", { refresh_token: session.refreshToken });
  if (result.success) {
    _storeSession({ access_token: result.data.access_token });
    return result.data.access_token;
  }
  _clearSession();
  return null;
}

// ── Client-facing auth functions (called via google.script.run) ──

function login(email, password) {
  var result = _rawAuthPost("/auth/login", { email: email, password: password });
  if (result.success) {
    _storeSession(result.data);
    return { success: true, user: result.data.user };
  }
  return { success: false, error: result.error };
}

function signup(email, password, fullName) {
  var result = _rawAuthPost("/auth/signup", { email: email, password: password, full_name: fullName || null });
  if (result.success) {
    _storeSession(result.data);
    return { success: true, user: result.data.user };
  }
  return { success: false, error: result.error };
}

function logout() {
  _clearSession();
  return { success: true };
}

function getSession() {
  var session = _getStoredSession();
  return { success: true, user: session ? session.user : null };
}

function requestPasswordReset(email) {
  return _rawAuthPost("/auth/forgot-password", { email: email });
}

// ─────────────────────────────────────────────────────────────────────────
// ── Server-Side API Proxy (Bypasses CORS restrictions) ──
// ─────────────────────────────────────────────────────────────────────────

function _fetchWithAuth(url, baseOptions, accessToken) {
  var options = {};
  for (var key in baseOptions) options[key] = baseOptions[key];
  if (accessToken) {
    options.headers = { Authorization: "Bearer " + accessToken };
  }
  try {
    var response = UrlFetchApp.fetch(url, options);
    return { responseCode: response.getResponseCode(), responseText: response.getContentText() };
  } catch (e) {
    return { error: e.toString() };
  }
}

/**
 * One request to the backend, with the caller's access token attached when
 * signed in, and a transparent refresh-and-retry-once on 401 — the same
 * contract as the extension's background.js authenticatedFetch. Callers
 * (callApiProxy, runOptimize) never see a raw 401; on refresh failure the
 * session is cleared and the original failure is what comes back.
 */
function _authenticatedRequest(endpoint, body, method) {
  var apiHost = API_BASE_URL;

  if (apiHost.substring(apiHost.length - 1) === "/") {
    apiHost = apiHost.substring(0, apiHost.length - 1);
  }

  var url = apiHost + endpoint;
  if (endpoint === "/health") {
    url = apiHost.replace(/\/api\/v1/i, "") + "/health";
  }

  var requestMethod = (method || "POST").toUpperCase();
  var options = {
    method: requestMethod,
    muteHttpExceptions: true
  };
  if (requestMethod !== "GET") {
    options.contentType = "application/json";
    if (body) {
      options.payload = JSON.stringify(body);
    }
  }

  var session = _getStoredSession();
  var attempt = _fetchWithAuth(url, options, session ? session.accessToken : null);

  if (attempt.responseCode === 401 && session && session.accessToken) {
    var refreshed = _refreshAccessToken();
    if (refreshed) {
      attempt = _fetchWithAuth(url, options, refreshed);
    }
  }

  attempt.url = url;
  return attempt;
}

function callApiProxy(endpoint, body, method) {
  var attempt = _authenticatedRequest(endpoint, body, method);

  if (attempt.error) {
    return { success: false, error: attempt.error + " (URL: " + attempt.url + ")" };
  }
  if (attempt.responseCode >= 200 && attempt.responseCode < 300) {
    return { success: true, data: JSON.parse(attempt.responseText) };
  }
  var errObj = {};
  try { errObj = JSON.parse(attempt.responseText); } catch (e) {}
  var errorMsg = errObj.detail || errObj.message || ("HTTP " + attempt.responseCode);
  return { success: false, error: errorMsg + " (URL: " + attempt.url + ")" };
}

// ── Unified history (signed-in only, matching /history's own auth requirement) ──

function getUnifiedHistory(limit) {
  return callApiProxy("/history?limit=" + (limit || 50), null, "GET");
}

function getHistoryStats() {
  return callApiProxy("/history/stats", null, "GET");
}

// ── Optimize Article ──
//
// UrlFetchApp has no incremental-read API — the request blocks until the
// full application/x-ndjson body has arrived, unlike the extension/web-app
// which can read it as a live stream. The full body is split into events
// here; SidebarJavaScript.html renders every stage card at once from the
// result rather than progressively. A slow run (restyle+summarize both on,
// a degraded primary provider triggering the sinllama->openrouter->mock
// fallback chain) can also brush against Apps Script's execution time
// ceiling — a real, platform-level limitation on this surface only.
function runOptimize(body) {
  var attempt = _authenticatedRequest("/optimize", body, "POST");

  if (attempt.error) {
    return { success: false, error: attempt.error + " (URL: " + attempt.url + ")" };
  }
  if (attempt.responseCode < 200 || attempt.responseCode >= 300) {
    var errObj = {};
    try { errObj = JSON.parse(attempt.responseText); } catch (e) {}
    var errorMsg = errObj.detail || errObj.message || ("HTTP " + attempt.responseCode);
    return { success: false, error: errorMsg + " (URL: " + attempt.url + ")" };
  }

  var events = [];
  var lines = attempt.responseText.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].replace(/^\s+|\s+$/g, "");
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch (e) {
      // Skip an unparseable line rather than fail the whole run over it.
    }
  }
  return { success: true, events: events };
}
