/**
 * SinAI Google Docs Add-on Server-Side Code
 * Handles Google Document DOM operations and proxies external API calls.
 */

// ── Lifecycle Hook: Document Opened ──
function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem("Open Assistant", "showSidebar")
    .addToUi();
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
  
  var textFragments = [];
  var elements = selection.getSelectedElements();
  
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    
    // Check if the element contains text
    if (element.getElement().editAsText) {
      var textElement = element.getElement().editAsText();
      var txt = textElement.getText();
      
      // If selection is partial (only some characters highlighted)
      if (element.isPartial()) {
        var start = element.getStartOffset();
        var end = element.getEndOffsetInclusive();
        textFragments.push(txt.substring(start, end + 1));
      } else {
        // Complete element selected
        textFragments.push(txt);
      }
    }
  }
  
  return textFragments.join("\n").trim();
}

// ── Replace Selected Text ──
function replaceSelectedText(newText) {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (!selection) {
    throw new Error("No text selected in the document.");
  }
  
  var elements = selection.getSelectedElements();
  var replaced = false;
  
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    
    if (element.getElement().editAsText) {
      var textElement = element.getElement().editAsText();
      
      if (element.isPartial()) {
        var start = element.getStartOffset();
        var end = element.getEndOffsetInclusive();
        
        if (!replaced) {
          textElement.deleteText(start, end);
          textElement.insertText(start, newText);
          replaced = true;
        } else {
          // Delete additional partial selections to avoid duplicated insertions
          textElement.deleteText(start, end);
        }
      } else {
        if (!replaced) {
          textElement.setText(newText);
          replaced = true;
        } else {
          // Remove parent container if it was fully selected to prevent duplicate empty blocks
          var parent = element.getElement().getParent();
          if (parent && parent.removeFromParent) {
            try {
              parent.removeFromParent();
            } catch (e) {
              textElement.setText(""); // fallback clear
            }
          }
        }
      }
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

// ── Server-Side API Proxy (Bypasses CORS restrictions) ──
function callApiProxy(endpoint, body, method) {
  var userProperties = PropertiesService.getUserProperties();
  var apiHost = userProperties.getProperty("apiHost") || "http://obc6jy896hk9b9u1fdzxkwvj.62.171.163.6.sslip.io/api/v1";
  
  // Clean up trailing slash
  if (apiHost.substring(apiHost.length - 1) === "/") {
    apiHost = apiHost.substring(0, apiHost.length - 1);
  }
  
  var url = apiHost + endpoint;
  var options = {
    method: method || "POST",
    contentType: "application/json",
    muteHttpExceptions: true // Allow us to catch 400/500 responses as JSON instead of throwing GAS runtime errors
  };
  
  if (body && method !== "GET") {
    options.payload = JSON.stringify(body);
  }
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      return { success: true, data: JSON.parse(responseText) };
    } else {
      var errObj = {};
      try {
        errObj = JSON.parse(responseText);
      } catch (e) {}
      var errorMsg = errObj.detail || errObj.message || ("HTTP " + responseCode);
      return { success: false, error: errorMsg };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
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
    apiHost: props.apiHost || "http://obc6jy896hk9b9u1fdzxkwvj.62.171.163.6.sslip.io/api/v1",
    defaultTone: props.defaultTone || "formal",
    defaultLength: props.defaultLength || "medium",
    defaultHeadlineCount: parseInt(props.defaultHeadlineCount || "5", 10)
  };
}
