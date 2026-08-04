/**
 * SinAI Chrome Extension Content Script
 * Scopes components inside an isolated Shadow DOM to avoid host CSS leaks.
 */

(function () {
  // Prevent double injection
  if (window.hasOwnProperty("sinaiAssistantLoaded")) return;
  window.sinaiAssistantLoaded = true;

  // ── Global References ──
  let activeSelectionText = "";
  let activeSelectionRange = null;
  let activeTargetElement = null; // The input/textarea that had the selection
  let inlineEnabled = true;
  let apiSettings = {
    defaultTone: "formal",
    defaultLength: "medium",
    defaultHeadlineCount: 5
  };

  // Load initial settings
  chrome.storage.local.get(["inlineEnabled", "defaultTone", "defaultLength", "defaultHeadlineCount"], (items) => {
    if (items.inlineEnabled !== undefined) inlineEnabled = items.inlineEnabled;
    if (items.defaultTone) apiSettings.defaultTone = items.defaultTone;
    if (items.defaultLength) apiSettings.defaultLength = items.defaultLength;
    if (items.defaultHeadlineCount) apiSettings.defaultHeadlineCount = items.defaultHeadlineCount;
  });

  // Pre-warm the backend server (wakes up Render free tier if sleeping)
  chrome.runtime.sendMessage({ action: "preWarm" });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.inlineEnabled) inlineEnabled = changes.inlineEnabled.newValue;
    if (changes.defaultTone) apiSettings.defaultTone = changes.defaultTone.newValue;
    if (changes.defaultLength) apiSettings.defaultLength = changes.defaultLength.newValue;
    if (changes.defaultHeadlineCount) apiSettings.defaultHeadlineCount = changes.defaultHeadlineCount.newValue;
  });

  // ── Create Isolated Shadow DOM Container ──
  const container = document.createElement("div");
  container.id = "sinai-assistant-shadow-container";
  // Block pointer events on wrapper itself, but allow them on children
  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "2147483645";
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: "open" });

  // Load stylesheet inside Shadow DOM
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content/content.css");
  shadowRoot.appendChild(styleLink);

  // ── Create Badge and Card DOM elements ──
  const badge = document.createElement("div");
  badge.className = "sinai-badge hidden";
  badge.style.pointerEvents = "auto";
  badge.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.5 5.6L5 7c.7-1.3 2-2.2 3.5-2.4m7 0c1.5.2 2.8 1.1 3.5 2.4l-2.5-1.4M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 4a6 6 0 0 1 6 6c0 1.5-.5 2.8-1.5 3.8l-1.4-1.4c.6-.6.9-1.5.9-2.4a4 4 0 0 0-4-4c-.9 0-1.8.3-2.4.9L8.2 7.5C9.2 6.5 10.5 6 12 6z"/>
    </svg>
  `;
  shadowRoot.appendChild(badge);

  const card = document.createElement("div");
  card.className = "sinai-card hidden";
  card.style.pointerEvents = "auto";
  card.innerHTML = `
    <div class="card-header">
      <div class="brand-title">
        <img src="${chrome.runtime.getURL("icons/icon.svg")}" class="brand-icon">
        <span class="brand-name">SinAI Assistant</span>
      </div>
      <button class="btn-close" id="sinai-close-card">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>

    <div class="tool-pills">
      <button class="pill-btn active" data-tool="grammar">Grammar</button>
      <button class="pill-btn" data-tool="headlines">Headlines</button>
      <button class="pill-btn" data-tool="rewriter">Style</button>
      <button class="pill-btn" data-tool="summarizer">Summary</button>
    </div>

    <!-- Options Sub Panel -->
    <div class="tool-options-panel hidden" id="sinai-options-panel">
      <!-- Options are dynamically mounted based on tool selection -->
    </div>

    <!-- Output box -->
    <div class="output-section">
      <div class="output-text placeholder" id="sinai-output-text">සත්‍යාපනය කිරීමට ක්‍රියාත්මක කරන්න (Run to process...)</div>
      <div class="inline-corrections-list hidden" id="sinai-inline-corrections"></div>
    </div>

    <!-- Actions -->
    <div class="action-controls">
      <button class="btn-inline-primary" id="sinai-btn-process">ක්‍රියාත්මක කරන්න</button>
      <button class="btn-inline-secondary hidden" id="sinai-btn-apply" title="පෙළ ප්‍රතිස්ථාපනය (Replace Selected)">Apply</button>
      <button class="btn-inline-secondary" id="sinai-btn-copy" title="පිටපත් කරන්න (Copy)">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
      </button>
    </div>
  `;
  shadowRoot.appendChild(card);

  // ── Card Internal Control Elements ──
  const btnClose = card.querySelector("#sinai-close-card");
  const toolPills = card.querySelectorAll(".pill-btn");
  const optionsPanel = card.querySelector("#sinai-options-panel");
  const outputText = card.querySelector("#sinai-output-text");
  const inlineCorrectionsList = card.querySelector("#sinai-inline-corrections");
  const btnProcess = card.querySelector("#sinai-btn-process");
  const btnApply = card.querySelector("#sinai-btn-apply");
  const btnCopy = card.querySelector("#sinai-btn-copy");

  let currentTool = "grammar";
  let toolOptionsState = {
    tone: "formal",
    length: "medium"
  };

  // ── Text Selection Listener ──
  document.addEventListener("mouseup", (e) => {
    // If the click is inside our Shadow DOM, ignore it to prevent badge flickering
    if (e.target.id === "sinai-assistant-shadow-container" || container.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      // Clear previous targets if text is empty
      if (!text) {
        if (badge.classList.contains("hidden") === false && !card.classList.contains("hidden")) {
          // If card is open, don't close it on simple click unless user clicks outside
        } else {
          hideBadge();
        }
        return;
      }

      // Check if text has Sinhala Unicode characters (\u0D80 to \u0DFF)
      const hasSinhala = /[\u0D80-\u0DFF]/.test(text);

      if (hasSinhala && inlineEnabled) {
        activeSelectionText = text;
        activeSelectionRange = selection.getRangeAt(0).cloneRange();
        activeTargetElement = document.activeElement;

        // Trigger a pre-warm ping when Sinhala is selected (wakes up Render before clicking process)
        chrome.runtime.sendMessage({ action: "preWarm" });

        showBadgeAtSelection(activeSelectionRange);
      } else {
        hideBadge();
      }
    }, 50);
  });

  // Dismiss everything if user clicks outside
  document.addEventListener("mousedown", (e) => {
    if (container.contains(e.target)) return;
    
    // Check if card is visible, if so, dismiss only if clicked elsewhere
    if (!card.classList.contains("hidden")) {
      hideCard();
    }
    hideBadge();
  });

  // ── Show / Hide Badge ──
  function showBadgeAtSelection(range) {
    if (!range) return;
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) return;
    
    // Position badge above and centered to the selection
    const badgeWidth = 32;
    const badgeHeight = 32;
    
    const left = rect.left + rect.width / 2 - badgeWidth / 2 + window.scrollX;
    const top = rect.top - badgeHeight - 6 + window.scrollY;

    badge.style.left = `${left}px`;
    badge.style.top = `${top}px`;
    badge.classList.remove("hidden");
  }

  function hideBadge() {
    badge.classList.add("hidden");
  }

  // ── Floating Badge Click ──
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    hideBadge();
    showCardAtSelection(activeSelectionRange);
  });

  // ── Show / Hide Card ──
  function showCardAtSelection(range) {
    let rect = null;
    if (range) {
      rect = range.getBoundingClientRect();
    }
    
    // Check if rect is valid
    const isValidRect = rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0);
    
    const cardWidth = 340;
    let left, top;
    
    if (isValidRect) {
      // Estimate position: center horizontally below selection
      left = rect.left + rect.width / 2 - cardWidth / 2 + window.scrollX;
      top = rect.bottom + 8 + window.scrollY;
    } else {
      // Fallback: Center in viewport
      left = window.innerWidth / 2 - cardWidth / 2 + window.scrollX;
      top = window.innerHeight / 3 + window.scrollY;
    }

    // Boundary check for left side of viewport
    if (left < 10) left = 10;
    // Boundary check for right side
    if (left + cardWidth > window.innerWidth - 10) {
      left = window.innerWidth - cardWidth - 10;
    }
    if (top < 10) top = 10;

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.remove("hidden");

    // Check if target element is editable to show/hide "Apply" replace button
    checkTargetEditable();

    // Reset card UI state
    resetCardUI();
  }

  function hideCard() {
    card.classList.add("hidden");
  }

  btnClose.addEventListener("click", hideCard);

  function checkTargetEditable() {
    if (activeTargetElement && 
        (activeTargetElement.tagName === "INPUT" || 
         activeTargetElement.tagName === "TEXTAREA" || 
         activeTargetElement.hasAttribute("contenteditable") || 
         activeTargetElement.isContentEditable)) {
      btnApply.classList.remove("hidden");
    } else {
      btnApply.classList.add("hidden");
    }
  }

  function resetCardUI() {
    outputText.className = "output-text placeholder";
    outputText.textContent = "සත්‍යාපනය කිරීමට ක්‍රියාත්මක කරන්න (Run to process...)";
    inlineCorrectionsList.classList.add("hidden");
    inlineCorrectionsList.innerHTML = "";
    btnProcess.disabled = false;
    btnProcess.classList.remove("loading");
    
    // Match pill selection
    toolPills.forEach(pill => {
      if (pill.getAttribute("data-tool") === currentTool) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    renderOptionsPanel();
  }

  // ── Pills Event Listeners ──
  toolPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      toolPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      
      currentTool = pill.getAttribute("data-tool");
      renderOptionsPanel();
      
      // Reset output panel text
      outputText.className = "output-text placeholder";
      outputText.textContent = "ක්‍රියාත්මක කරන්න (Run to process...)";
      inlineCorrectionsList.classList.add("hidden");
    });
  });

  // ── Render Options Panel dynamically ──
  function renderOptionsPanel() {
    optionsPanel.classList.add("hidden");
    optionsPanel.innerHTML = "";

    if (currentTool === "rewriter") {
      optionsPanel.classList.remove("hidden");
      optionsPanel.innerHTML = `
        <span class="options-label">ශෛලිය/ස්වරය:</span>
        <select class="inline-select" id="sinai-inline-select-tone">
          <option value="formal" ${toolOptionsState.tone === "formal" ? "selected" : ""}>Formal (නිල)</option>
          <option value="sports" ${toolOptionsState.tone === "sports" ? "selected" : ""}>Sports (ක්‍රීඩා)</option>
          <option value="youth" ${toolOptionsState.tone === "youth" ? "selected" : ""}>Youth (තරුණ)</option>
          <option value="editorial" ${toolOptionsState.tone === "editorial" ? "selected" : ""}>Editorial (සංස්කාරකීය)</option>
          <option value="feature" ${toolOptionsState.tone === "feature" ? "selected" : ""}>Feature (විශේෂාංග)</option>
        </select>
      `;
      optionsPanel.querySelector("#sinai-inline-select-tone").addEventListener("change", (e) => {
        toolOptionsState.tone = e.target.value;
      });
    } else if (currentTool === "summarizer") {
      optionsPanel.classList.remove("hidden");
      optionsPanel.innerHTML = `
        <span class="options-label">ප්‍රමාණය:</span>
        <select class="inline-select" id="sinai-inline-select-length">
          <option value="short" ${toolOptionsState.length === "short" ? "selected" : ""}>කෙටි (Short)</option>
          <option value="medium" ${toolOptionsState.length === "medium" ? "selected" : ""}>මධ්‍යම (Medium)</option>
          <option value="long" ${toolOptionsState.length === "long" ? "selected" : ""}>දීර්ඝ (Long)</option>
        </select>
      `;
      optionsPanel.querySelector("#sinai-inline-select-length").addEventListener("change", (e) => {
        toolOptionsState.length = e.target.value;
      });
    }
  }

  // ── Process Active Tool Button ──
  btnProcess.addEventListener("click", () => {
    if (!activeSelectionText) return;

    btnProcess.disabled = true;
    btnProcess.classList.add("loading");
    outputText.className = "output-text placeholder";
    outputText.textContent = "Processing...";
    inlineCorrectionsList.classList.add("hidden");

    let endpoint = "/grammar/check";
    let body = { text: activeSelectionText };

    if (currentTool === "headlines") {
      endpoint = "/headlines/generate";
      body = { text: activeSelectionText, count: apiSettings.defaultHeadlineCount };
    } else if (currentTool === "rewriter") {
      endpoint = "/rewrite";
      body = { text: activeSelectionText, tone: toolOptionsState.tone };
    } else if (currentTool === "summarizer") {
      endpoint = "/summarize";
      body = { text: activeSelectionText, length: toolOptionsState.length };
    }

    // Call API proxy in background
    chrome.runtime.sendMessage(
      {
        action: "callApi",
        endpoint,
        body,
        method: "POST"
      },
      (response) => {
        btnProcess.disabled = false;
        btnProcess.classList.remove("loading");

        if (!response || !response.success) {
          outputText.className = "output-text error";
          outputText.textContent = `API Error: ${response ? response.error : "Unknown connection error"}`;
          return;
        }

        renderInlineResult(response.data);
      }
    );
  });

  // ── Render Inline Response ──
  function renderInlineResult(data) {
    outputText.className = "output-text";
    inlineCorrectionsList.innerHTML = "";
    inlineCorrectionsList.classList.add("hidden");

    if (currentTool === "grammar") {
      outputText.textContent = data.corrected;
      
      if (data.corrections && data.corrections.length > 0) {
        inlineCorrectionsList.classList.remove("hidden");
        
        data.corrections.forEach((c) => {
          const div = document.createElement("div");
          div.className = "inline-corr-item";
          div.innerHTML = `
            <div class="inline-corr-comp">
              <span class="inline-corr-orig">${escapeHtml(c.original)}</span>
              <span class="inline-corr-arrow">➔</span>
              <span class="inline-corr-new">${escapeHtml(c.corrected)}</span>
            </div>
          `;
          inlineCorrectionsList.appendChild(div);
        });
      } else {
        inlineCorrectionsList.classList.remove("hidden");
        inlineCorrectionsList.innerHTML = `<span style="color: #10B981; font-size: 0.72rem; display: block; text-align: center;">👍 ව්‍යාකරණ දෝෂ කිසිවක් හමු නොවීය.</span>`;
      }
    } else if (currentTool === "headlines") {
      const headlinesText = data.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
      outputText.textContent = headlinesText;
    } else if (currentTool === "rewriter") {
      outputText.textContent = data.rewritten;
    } else if (currentTool === "summarizer") {
      outputText.textContent = data.summary;
    }
  }

  // ── Copy Result ──
  btnCopy.addEventListener("click", () => {
    let copyText = outputText.textContent;
    if (outputText.classList.contains("placeholder")) return;

    navigator.clipboard.writeText(copyText).then(() => {
      const originalSvg = btnCopy.innerHTML;
      btnCopy.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#10B981" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
      setTimeout(() => {
        btnCopy.innerHTML = originalSvg;
      }, 1500);
    });
  });

  // ── Apply Replacement to Input Field ──
  btnApply.addEventListener("click", () => {
    let replacement = outputText.textContent;
    if (outputText.classList.contains("placeholder") || !replacement) return;

    if (activeTargetElement) {
      activeTargetElement.focus();
      
      // If it is contenteditable or input/textarea
      const isEditable = activeTargetElement.tagName === "INPUT" || 
                         activeTargetElement.tagName === "TEXTAREA";
      
      if (isEditable) {
        const start = activeTargetElement.selectionStart;
        const end = activeTargetElement.selectionEnd;
        const text = activeTargetElement.value;
        
        // Use document.execCommand to support Undo buffer if possible
        try {
          document.execCommand("insertText", false, replacement);
        } catch (e) {
          // Direct fallback if execCommand fails
          activeTargetElement.value = text.substring(0, start) + replacement + text.substring(end);
        }
      } else {
        // Contenteditable or standard selection on body/editor
        try {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(replacement);
            range.insertNode(textNode);
            range.selectNodeContents(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } catch (err) {
          console.warn("Inline Apply Selection replacement failed:", err);
        }
      }
    }
    
    hideCard();
  });

  // ── Handle Context Menu Invocations from Service Worker ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "triggerInlineAssistant") {
      const { mode, text } = message;
      
      activeSelectionText = text;
      currentTool = mode;
      
      // Find where target element is
      activeTargetElement = document.activeElement;
      
      // Attempt to get selection range coordinates or fall back to cursor position
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        activeSelectionRange = selection.getRangeAt(0).cloneRange();
        showCardAtSelection(activeSelectionRange);
      } else {
        // Fall back position in center of screen
        const left = window.innerWidth / 2 - 170 + window.scrollX;
        const top = window.innerHeight / 3 + window.scrollY;
        
        card.style.left = `${left}px`;
        card.style.top = `${top}px`;
        card.classList.remove("hidden");
        checkTargetEditable();
        resetCardUI();
      }

      // Auto trigger processing for convenience!
      setTimeout(() => {
        btnProcess.click();
      }, 100);

      sendResponse({ success: true });
    }
  });

  // ── Helper Utilities ──
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ── Auto-Extraction for Supported News Sites ──
  const SITE_EXTRACTORS = {
    "adaderana.lk": ".news-content, .story-text",
    "hirunews.lk": ".article-content, #article-content, .news-text, .news-content",
    "lankadeepa.lk": ".post-content, .entry-content",
    "divaina.lk": ".entry-content, .post-content",
    "dinamina.lk": ".entry-content",
    "silumina.lk": ".entry-content",
    "mawbima.lk": ".post-content"
  };

  function autoProcessArticle() {
    const hostname = window.location.hostname;
    let articleSelector = null;

    for (const [domain, selector] of Object.entries(SITE_EXTRACTORS)) {
      if (hostname.includes(domain)) {
        articleSelector = selector;
        break;
      }
    }

    if (articleSelector) {
      // Find the article element on the page
      const articleElement = document.querySelector(articleSelector);
      
      if (articleElement && articleElement.innerText.trim().length > 100) {
        // Automatically set the text as if the user selected it
        activeSelectionText = articleElement.innerText.trim();
        
        // Show number in extension icon
        chrome.runtime.sendMessage({ action: "updateBadge", text: "1" }).catch(() => {});

        // Show the SinAI floating badge fixed at the bottom right corner
        const badgeWidth = 32;
        const badgeHeight = 32;
        const left = window.innerWidth - badgeWidth - 30 + window.scrollX;
        const top = window.innerHeight - badgeHeight - 30 + window.scrollY;

        badge.style.left = `${left}px`;
        badge.style.top = `${top}px`;
        badge.style.position = "fixed"; // Keep it fixed on screen
        badge.classList.remove("hidden");
      }
    }
  }

  window.addEventListener('load', () => {
    setTimeout(autoProcessArticle, 1000);
  });
})();
