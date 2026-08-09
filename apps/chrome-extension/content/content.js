/**
 * SinAI Chrome Extension Content Script
 * Scopes components inside an isolated Shadow DOM to avoid host CSS leaks.
 *
 * The stylesheet below is injected via a synchronous inline <style> rather
 * than an async <link>. It used to be the latter, loaded from content.css —
 * but <link> stylesheets load asynchronously even for local extension
 * resources, so there was a window on every page load where the badge/card
 * existed in the shadow DOM with their "hidden" class already applied but no
 * CSS rule yet defining what "hidden" means. In that window they rendered at
 * browser-default size inside their full-viewport container, which is what
 * showed up as a full-screen flash that vanished the instant the stylesheet
 * finished loading. Inlining the CSS makes it apply in the same tick the
 * elements are created, so nothing is ever visible unstyled.
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
  let optimizeOptions = {
    restyle: false,
    summarize: false,
    tone: "formal",
    length: "medium"
  };

  // Load initial settings
  chrome.storage.local.get(
    ["inlineEnabled", "defaultTone", "defaultLength", "defaultHeadlineCount"],
    (items) => {
      if (items.inlineEnabled !== undefined) inlineEnabled = items.inlineEnabled;
      if (items.defaultTone) apiSettings.defaultTone = items.defaultTone;
      if (items.defaultLength) apiSettings.defaultLength = items.defaultLength;
      if (items.defaultHeadlineCount) apiSettings.defaultHeadlineCount = items.defaultHeadlineCount;
    }
  );

  // Pre-warm the backend server (wakes up Render free tier if sleeping)
  chrome.runtime.sendMessage({ action: "preWarm" });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.inlineEnabled) inlineEnabled = changes.inlineEnabled.newValue;
    if (changes.defaultTone) apiSettings.defaultTone = changes.defaultTone.newValue;
    if (changes.defaultLength) apiSettings.defaultLength = changes.defaultLength.newValue;
    if (changes.defaultHeadlineCount) apiSettings.defaultHeadlineCount = changes.defaultHeadlineCount.newValue;
  });

  // ── Brand assets — same tokens/marks as the web app ──
  const ICON_URL = chrome.runtime.getURL("icons/icon128.png");
  const GWEN_BOLD_URL = chrome.runtime.getURL("fonts/Gwen-Trial-Bold.woff2");
  const GWEN_REGULAR_URL = chrome.runtime.getURL("fonts/Gwen-Trial-Regular.woff2");

  const SINAI_STYLES = `
    :host {
      all: initial;
      display: block;
      font-family: 'Satoshi', 'Noto Sans Sinhala', ui-sans-serif, system-ui, sans-serif;
    }

    @font-face {
      font-family: 'Gwen';
      src: url('${GWEN_BOLD_URL}') format('woff2');
      font-weight: bold;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Gwen';
      src: url('${GWEN_REGULAR_URL}') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    /* Satoshi (UI chrome) — same face as web-app/index.html and the popup,
       via Fontshare's CDN. Hardcoded font URLs rather than an @import: an
       @import inside a shadow-root <style> is unreliable, since it depends
       on being fetched and applied before first paint the same way the
       inline styles here already are (see file header comment). */
    @font-face {
      font-family: 'Satoshi';
      src: url('https://cdn.fontshare.com/wf/TTX2Z3BF3P6Y5BQT3IV2VNOK6FL22KUT/7QYRJOI3JIMYHGY6CH7SOIFRQLZOLNJ6/KFIAZD4RUMEZIYV6FQ3T3GP5PDBDB6JY.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Satoshi';
      src: url('https://cdn.fontshare.com/wf/LAFFD4SDUCDVQEXFPDC7C53EQ4ZELWQI/PXCT3G6LO6ICM5I3NTYENYPWJAECAWDD/GHM6WVH6MILNYOOCXHXB5GTSGNTMGXZR.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    .hidden { display: none !important; }

    /* ── Badge — the floating trigger that appears on selection ── */
    .sinai-badge {
      position: absolute;
      z-index: 2147483646;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid #e4e2e2;
      box-shadow: 0 4px 12px -2px rgba(22,17,18,0.14), 0 2px 4px rgba(22,17,18,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      padding: 6px;
      box-sizing: border-box;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      animation: sinaiBadgePop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    .sinai-badge:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 16px -2px rgba(22,17,18,0.18), 0 3px 6px rgba(22,17,18,0.1);
    }
    .sinai-badge:active { cursor: grabbing; }
    .sinai-badge img { width: 100%; height: 100%; object-fit: contain; display: block; }

    @keyframes sinaiBadgePop {
      0% { opacity: 0; transform: scale(0.5); }
      100% { opacity: 1; transform: scale(1); }
    }

    /* ── Card — always opens centered in the viewport (fixed, not
       document-relative), and is draggable by its header regardless of
       where the page is scrolled. ── */
    .sinai-card {
      position: fixed;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      width: 380px;
      height: 480px;
      min-width: 320px;
      min-height: 260px;
      max-width: min(640px, 92vw);
      max-height: min(720px, 88vh);
      resize: both;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid #e4e2e2;
      border-radius: 16px;
      box-shadow: 0 16px 40px -8px rgba(22,17,18,0.18), 0 4px 12px -2px rgba(22,17,18,0.1);
      animation: sinaiCardFadeIn 0.2s cubic-bezier(0.16,1,0.3,1) forwards;
    }
    @keyframes sinaiCardFadeIn {
      0% { opacity: 0; transform: translateY(4px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-bottom: 1px solid #f0efef;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
    }
    .card-header:active { cursor: grabbing; }
    .brand-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .brand-icon { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; object-fit: contain; }
    .brand-name {
      font-family: 'Gwen', 'Satoshi', sans-serif;
      font-size: 16px;
      color: #1d1819;
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-hint {
      margin-left: auto;
      margin-right: 4px;
      color: #d2cfcf;
      flex-shrink: 0;
    }
    .btn-close {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: #a6a2a2;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .btn-close:hover { background: #f0efef; color: #1d1819; }

    .card-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 12px 14px 14px;
      gap: 10px;
    }

    .tool-pills { display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
    .pill-btn {
      padding: 6px 13px;
      border-radius: 999px;
      border: 1px solid #e4e2e2;
      background: #ffffff;
      color: #5b5656;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: -0.01em;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
      white-space: nowrap;
    }
    .pill-btn:hover { background: #f8f7f7; border-color: #d2cfcf; color: #1d1819; }
    .pill-btn.active {
      background: #cd191a;
      border-color: #cd191a;
      color: #ffffff;
      box-shadow: 0 2px 6px -1px rgba(205, 25, 26, 0.35);
    }
    .pill-btn.optimize-pill { border-color: #f3a8a7; color: #ab1112; }
    .pill-btn.optimize-pill:hover { background: #fdf3f2; border-color: #e97371; color: #ab1112; }
    .pill-btn.optimize-pill.active {
      background: linear-gradient(135deg, #cd191a, #ab1112);
      border-color: transparent;
      color: #ffffff;
    }

    .tool-options-panel {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 9px 10px;
      background: #f8f7f7;
      border-radius: 10px;
      flex-shrink: 0;
    }
    .options-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .options-label { font-size: 11px; font-weight: 600; color: #7b7676; white-space: nowrap; }
    .inline-select {
      flex: 1;
      min-width: 100px;
      padding: 5px 8px;
      border-radius: 7px;
      border: 1px solid #e4e2e2;
      background: #ffffff;
      color: #1d1819;
      font-size: 12px;
      cursor: pointer;
    }
    .optimize-toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      font-size: 12px;
      font-weight: 500;
      color: #443f40;
      cursor: pointer;
    }
    .optimize-toggle-row input[type="checkbox"] {
      accent-color: #cd191a;
      width: 14px;
      height: 14px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .optimize-sub-select { margin-left: 20px; width: calc(100% - 20px); }

    .output-section {
      flex: 1;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .output-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #a6a2a2;
      flex-shrink: 0;
    }
    .output-label.is-result { color: #059669; }
    .output-label.is-error { color: #ab1112; }
    .output-text {
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #f0efef;
      background: #f8f7f7;
      font-size: 13px;
      line-height: 1.6;
      color: #1d1819;
      white-space: pre-wrap;
    }
    .output-text.placeholder { color: #a6a2a2; }
    .output-text.error { color: #ab1112; background: #fdf3f2; border-color: #f9cecd; }

    /* Shared shimmer line — used both while a single tool runs and inside
       each Optimize stage card. */
    .sinai-shimmer-line {
      height: 12px;
      border-radius: 6px;
      margin: 3px 0;
      background: linear-gradient(90deg, #f0efef 0%, #f8f7f7 40%, #f0efef 80%);
      background-size: 200% 100%;
      animation: sinaiShimmer 1.4s ease-in-out infinite;
    }

    .optimize-results { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 7px; }
    .optimize-stage { border: 1px solid #f0efef; border-radius: 10px; overflow: hidden; flex-shrink: 0; }
    .optimize-stage-head {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      background: #f8f7f7;
      font-size: 11px;
      font-weight: 700;
      color: #443f40;
    }
    .optimize-stage-status { margin-left: auto; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .optimize-stage-status.done { color: #059669; }
    .optimize-stage-status.running { color: #ab1112; }
    .optimize-stage-status.failed { color: #ab1112; }
    .optimize-stage-status.pending,
    .optimize-stage-status.skipped { color: #a6a2a2; }
    .optimize-stage-body {
      padding: 8px 10px;
      font-size: 12.5px;
      line-height: 1.55;
      color: #2c2728;
      white-space: pre-wrap;
    }

    .inline-corrections-list { display: flex; flex-direction: column; gap: 4px; }
    .inline-corr-item { padding: 6px 9px; border-radius: 8px; background: #fdf3f2; border: 1px solid #f9cecd; }
    .inline-corr-comp { display: flex; align-items: center; gap: 6px; font-size: 12px; flex-wrap: wrap; }
    .inline-corr-orig { color: #ab1112; text-decoration: line-through; opacity: 0.75; }
    .inline-corr-arrow { color: #a6a2a2; font-size: 10px; }
    .inline-corr-new { color: #1d1819; font-weight: 600; }

    /* Substitution-guard states. The ordinary item above already sits on the
       brand tint, so a flagged one needs a heavier fill AND a left bar to read
       as different rather than as more of the same — otherwise everything
       looks mildly alarming and nothing stands out. No icon glyph: the card
       is emoji-free by design. */
    .inline-corr-warning {
      padding: 7px 9px;
      border-radius: 8px;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      font-size: 11.5px;
      font-weight: 600;
      line-height: 1.35;
    }
    .inline-corr-item.is-flagged {
      background: #fee2e2;
      border-color: #fca5a5;
      border-left: 3px solid #dc2626;
    }
    .inline-corr-item.is-flagged .inline-corr-new { color: #7f1d1d; }
    .inline-corr-reason {
      margin-top: 3px;
      font-size: 10.5px;
      line-height: 1.4;
      color: #b91c1c;
    }

    .action-controls { display: flex; gap: 6px; flex-shrink: 0; }
    .btn-inline-primary {
      flex: 1;
      position: relative;
      padding: 9px 14px;
      border-radius: 10px;
      border: none;
      background: #cd191a;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-inline-primary:hover { background: #ab1112; }
    .btn-inline-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    /* Loading state shimmers rather than spins, matching the rest of the
       product — see the web app's ShimmerDot. */
    .btn-inline-primary.loading { color: transparent; }
    .btn-inline-primary.loading::after {
      content: "";
      position: absolute;
      top: 50%; left: 50%;
      width: 16px; height: 16px;
      margin: -8px 0 0 -8px;
      border-radius: 50%;
      background: linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.35) 80%);
      background-size: 200% 100%;
      animation: sinaiShimmer 1.2s ease-in-out infinite;
    }
    @keyframes sinaiShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .btn-inline-secondary {
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid #e4e2e2;
      background: #ffffff;
      color: #443f40;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .btn-inline-secondary:hover { background: #f8f7f7; border-color: #d2cfcf; }
  `;

  // ── Create Isolated Shadow DOM Container ──
  const container = document.createElement("div");
  container.id = "sinai-assistant-shadow-container";
  container.style.position = "absolute";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.pointerEvents = "none";
  container.style.zIndex = "2147483645";
  document.body.appendChild(container);

  const shadowRoot = container.attachShadow({ mode: "open" });

  // Synchronous — applies in the same tick badge/card are created, so
  // nothing is ever visible unstyled (see file header comment).
  const styleEl = document.createElement("style");
  styleEl.textContent = SINAI_STYLES;
  shadowRoot.appendChild(styleEl);

  // ── Create Badge and Card DOM elements ──
  const badge = document.createElement("div");
  badge.className = "sinai-badge hidden";
  // Belt-and-suspenders: correct even if the shadow root were ever rendered
  // before the <style> above (e.g. a future refactor reintroduces async
  // loading) rather than relying solely on the "hidden" class.
  badge.style.display = "none";
  badge.style.pointerEvents = "auto";
  badge.innerHTML = `<img src="${ICON_URL}" alt="SinAi">`;
  shadowRoot.appendChild(badge);

  const card = document.createElement("div");
  card.className = "sinai-card hidden";
  card.style.display = "none";
  card.style.pointerEvents = "auto";
  card.innerHTML = `
    <div class="card-header">
      <div class="brand-title">
        <img src="${ICON_URL}" class="brand-icon" alt="SinAi">
        <span class="brand-name">SinAi</span>
      </div>
      <button class="btn-close" id="sinai-close-card" title="Close" aria-label="Close">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>

    <div class="card-body">
      <div class="tool-pills">
        <button class="pill-btn active" data-tool="grammar">Grammar</button>
        <button class="pill-btn" data-tool="headlines">Headlines</button>
        <button class="pill-btn" data-tool="rewriter">Style</button>
        <button class="pill-btn" data-tool="summarizer">Summary</button>
        <button class="pill-btn optimize-pill" data-tool="optimize">Optimize</button>
      </div>

      <div class="tool-options-panel hidden" id="sinai-options-panel">
        <!-- Options are dynamically mounted based on tool selection -->
      </div>

      <div class="output-section">
        <span class="output-label" id="sinai-output-label">Selected text</span>
        <div class="output-text" id="sinai-output-text"></div>
        <div class="inline-corrections-list hidden" id="sinai-inline-corrections"></div>
        <div class="optimize-results hidden" id="sinai-optimize-results"></div>
      </div>

      <div class="action-controls">
        <button class="btn-inline-primary" id="sinai-btn-process">Run</button>
        <button class="btn-inline-secondary hidden" id="sinai-btn-apply" title="Replace selected text">Apply</button>
        <button class="btn-inline-secondary" id="sinai-btn-copy" title="Copy">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
      </div>
    </div>
  `;
  shadowRoot.appendChild(card);

  // ── Card Internal Control Elements ──
  const btnClose = card.querySelector("#sinai-close-card");
  const toolPills = card.querySelectorAll(".pill-btn");
  const optionsPanel = card.querySelector("#sinai-options-panel");
  const outputLabel = card.querySelector("#sinai-output-label");
  const outputText = card.querySelector("#sinai-output-text");
  const inlineCorrectionsList = card.querySelector("#sinai-inline-corrections");
  const optimizeResultsEl = card.querySelector("#sinai-optimize-results");
  const btnProcess = card.querySelector("#sinai-btn-process");
  const btnApply = card.querySelector("#sinai-btn-apply");
  const btnCopy = card.querySelector("#sinai-btn-copy");

  // ── Dragging ──
  // Shared by the badge and the card header. `target`'s on-screen position
  // is read via getBoundingClientRect (always viewport-relative); whether
  // that has to be converted before writing back to style.left/top depends
  // on target's own position mode: "fixed" is already viewport-relative,
  // "absolute" is relative to the full-document-height shadow container, so
  // the current scroll offset has to be added back in for that case.
  function makeDraggable(handle, target, options = {}) {
    const DRAG_THRESHOLD = 4; // px of movement before a mousedown counts as a drag, not a click
    let dragging = false;
    let moved = false;
    let startClientX = 0;
    let startClientY = 0;
    let startLeft = 0;
    let startTop = 0;

    handle.addEventListener("mousedown", (e) => {
      if (options.ignoreSelector && e.target.closest(options.ignoreSelector)) return;
      dragging = true;
      moved = false;
      startClientX = e.clientX;
      startClientY = e.clientY;
      const rect = target.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (!moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) moved = true;
      if (!moved) return;

      const isFixed = getComputedStyle(target).position === "fixed";
      const width = target.offsetWidth;

      // Clamped so a drag can never leave the panel fully off-screen and
      // unreachable.
      let newLeft = Math.min(Math.max(startLeft + dx, -width + 60), window.innerWidth - 60);
      let newTop = Math.min(Math.max(startTop + dy, 0), window.innerHeight - 40);

      target.style.left = `${isFixed ? newLeft : newLeft + window.scrollX}px`;
      target.style.top = `${isFixed ? newTop : newTop + window.scrollY}px`;
      target.style.position = isFixed ? "fixed" : "absolute";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
    });

    return { wasDragged: () => moved };
  }

  const badgeDrag = makeDraggable(badge, badge);
  const cardHeaderEl = card.querySelector(".card-header");
  makeDraggable(cardHeaderEl, card, { ignoreSelector: "#sinai-close-card" });

  let currentTool = "grammar";
  let toolOptionsState = {
    tone: "formal",
    length: "medium"
  };

  // Matches the web app's per-tool action labels (Editor.jsx / TOOL_CONFIG) —
  // "Run" told the user nothing about what was about to happen.
  const TOOL_RUN_LABEL = {
    grammar: "Correct",
    headlines: "Generate",
    rewriter: "Rewrite",
    summarizer: "Summarize",
    optimize: "Optimize"
  };

  // ── Text Selection Listener ──
  document.addEventListener("mouseup", (e) => {
    if (e.target.id === "sinai-assistant-shadow-container" || container.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (!text) {
        if (badge.classList.contains("hidden") === false && !card.classList.contains("hidden")) {
          // If card is open, don't close it on simple click unless user clicks outside
        } else {
          hideBadge();
        }
        return;
      }

      const hasSinhala = /[඀-෿]/.test(text);

      if (hasSinhala && inlineEnabled) {
        activeSelectionText = text;
        activeSelectionRange = selection.getRangeAt(0).cloneRange();
        activeTargetElement = document.activeElement;

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

    const badgeWidth = 36;
    const badgeHeight = 36;

    const left = rect.left + rect.width / 2 - badgeWidth / 2 + window.scrollX;
    const top = rect.top - badgeHeight - 6 + window.scrollY;

    badge.style.left = `${left}px`;
    badge.style.top = `${top}px`;
    badge.style.position = "absolute";
    badge.style.display = "";
    badge.classList.remove("hidden");
  }

  function hideBadge() {
    badge.classList.add("hidden");
    badge.style.display = "none";
  }

  // ── Floating Badge Click ──
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    // A real drag just ended on this same mouseup/click pair — don't also
    // treat it as "open the card".
    if (badgeDrag.wasDragged()) return;
    hideBadge();
    showCard();
  });

  // ── Show / Hide Card ──
  // Always opens centered in the viewport rather than anchored to the
  // selection — predictable regardless of where on the page the selection
  // was, and never clipped near an edge. The user can drag it by the header
  // afterward (see makeDraggable above).
  function showCard() {
    const cardWidth = 380;
    const cardHeight = 480;
    const left = Math.max(10, window.innerWidth / 2 - cardWidth / 2);
    const top = Math.max(10, window.innerHeight / 2 - cardHeight / 2);

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.display = "";
    card.classList.remove("hidden");

    checkTargetEditable();
    resetCardUI();
  }

  function hideCard() {
    card.classList.add("hidden");
    card.style.display = "none";
  }

  btnClose.addEventListener("click", hideCard);

  function checkTargetEditable() {
    if (
      activeTargetElement &&
      (activeTargetElement.tagName === "INPUT" ||
        activeTargetElement.tagName === "TEXTAREA" ||
        activeTargetElement.hasAttribute("contenteditable") ||
        activeTargetElement.isContentEditable)
    ) {
      btnApply.classList.remove("hidden");
    } else {
      btnApply.classList.add("hidden");
    }
  }

  // Shows what's actually selected — the whole point being that the user
  // should never have to wonder "did it pick up my selection?". Only the
  // no-selection edge case (e.g. a context-menu invocation with nothing
  // selected) falls back to a placeholder.
  function resetCardUI() {
    outputLabel.textContent = "Selected text";
    outputLabel.className = "output-label";

    if (activeSelectionText) {
      outputText.className = "output-text";
      outputText.textContent = activeSelectionText;
    } else {
      outputText.className = "output-text placeholder";
      outputText.textContent = "No text selected.";
    }
    outputText.classList.remove("hidden");
    outputLabel.classList.remove("hidden");
    inlineCorrectionsList.classList.add("hidden");
    inlineCorrectionsList.innerHTML = "";
    optimizeResultsEl.classList.add("hidden");
    optimizeResultsEl.innerHTML = "";
    btnProcess.disabled = false;
    btnProcess.classList.remove("loading");
    btnProcess.textContent = TOOL_RUN_LABEL[currentTool];

    toolPills.forEach((pill) => {
      pill.classList.toggle("active", pill.getAttribute("data-tool") === currentTool);
    });

    renderOptionsPanel();
  }

  // ── Pills Event Listeners ──
  toolPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      currentTool = pill.getAttribute("data-tool");
      resetCardUI();
    });
  });

  // ── Render Options Panel dynamically ──
  function renderOptionsPanel() {
    optionsPanel.classList.add("hidden");
    optionsPanel.innerHTML = "";

    if (currentTool === "rewriter") {
      optionsPanel.classList.remove("hidden");
      optionsPanel.innerHTML = `
        <div class="options-row">
          <span class="options-label">Style:</span>
          <select class="inline-select" id="sinai-inline-select-tone">
            <option value="formal" ${toolOptionsState.tone === "formal" ? "selected" : ""}>Formal</option>
            <option value="sports" ${toolOptionsState.tone === "sports" ? "selected" : ""}>Sports</option>
            <option value="youth" ${toolOptionsState.tone === "youth" ? "selected" : ""}>Youth</option>
            <option value="editorial" ${toolOptionsState.tone === "editorial" ? "selected" : ""}>Editorial</option>
            <option value="feature" ${toolOptionsState.tone === "feature" ? "selected" : ""}>Feature</option>
          </select>
        </div>
      `;
      optionsPanel.querySelector("#sinai-inline-select-tone").addEventListener("change", (e) => {
        toolOptionsState.tone = e.target.value;
      });
    } else if (currentTool === "summarizer") {
      optionsPanel.classList.remove("hidden");
      optionsPanel.innerHTML = `
        <div class="options-row">
          <span class="options-label">Length:</span>
          <select class="inline-select" id="sinai-inline-select-length">
            <option value="short" ${toolOptionsState.length === "short" ? "selected" : ""}>Short</option>
            <option value="medium" ${toolOptionsState.length === "medium" ? "selected" : ""}>Medium</option>
            <option value="long" ${toolOptionsState.length === "long" ? "selected" : ""}>Long</option>
          </select>
        </div>
      `;
      optionsPanel.querySelector("#sinai-inline-select-length").addEventListener("change", (e) => {
        toolOptionsState.length = e.target.value;
      });
    } else if (currentTool === "optimize") {
      // Grammar and headlines always run; restyle and summary are opt-in
      // extra stages — matches the web app's Optimize Article behavior.
      optionsPanel.classList.remove("hidden");
      optionsPanel.innerHTML = `
        <label class="optimize-toggle-row">
          <input type="checkbox" id="sinai-opt-restyle" ${optimizeOptions.restyle ? "checked" : ""}>
          Also rewrite style
        </label>
        <select class="inline-select optimize-sub-select ${optimizeOptions.restyle ? "" : "hidden"}" id="sinai-opt-tone">
          <option value="formal" ${optimizeOptions.tone === "formal" ? "selected" : ""}>Formal</option>
          <option value="sports" ${optimizeOptions.tone === "sports" ? "selected" : ""}>Sports</option>
          <option value="youth" ${optimizeOptions.tone === "youth" ? "selected" : ""}>Youth</option>
          <option value="editorial" ${optimizeOptions.tone === "editorial" ? "selected" : ""}>Editorial</option>
          <option value="feature" ${optimizeOptions.tone === "feature" ? "selected" : ""}>Feature</option>
        </select>
        <label class="optimize-toggle-row">
          <input type="checkbox" id="sinai-opt-summarize" ${optimizeOptions.summarize ? "checked" : ""}>
          Also write summary
        </label>
        <select class="inline-select optimize-sub-select ${optimizeOptions.summarize ? "" : "hidden"}" id="sinai-opt-length">
          <option value="short" ${optimizeOptions.length === "short" ? "selected" : ""}>Short</option>
          <option value="medium" ${optimizeOptions.length === "medium" ? "selected" : ""}>Medium</option>
          <option value="long" ${optimizeOptions.length === "long" ? "selected" : ""}>Long</option>
        </select>
      `;
      const restyleCheck = optionsPanel.querySelector("#sinai-opt-restyle");
      const toneSelect = optionsPanel.querySelector("#sinai-opt-tone");
      const summarizeCheck = optionsPanel.querySelector("#sinai-opt-summarize");
      const lengthSelect = optionsPanel.querySelector("#sinai-opt-length");

      restyleCheck.addEventListener("change", (e) => {
        optimizeOptions.restyle = e.target.checked;
        toneSelect.classList.toggle("hidden", !e.target.checked);
      });
      toneSelect.addEventListener("change", (e) => { optimizeOptions.tone = e.target.value; });
      summarizeCheck.addEventListener("change", (e) => {
        optimizeOptions.summarize = e.target.checked;
        lengthSelect.classList.toggle("hidden", !e.target.checked);
      });
      lengthSelect.addEventListener("change", (e) => { optimizeOptions.length = e.target.value; });
    }
  }

  // ── Call the backend via the background proxy (Promise wrapper) ──
  function callApi(endpoint, body) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "callApi", endpoint, body, method: "POST" },
        (response) => {
          if (!response || !response.success) {
            reject(new Error(response ? response.error : "Unknown connection error"));
            return;
          }
          resolve(response.data);
        }
      );
    });
  }

  // ── Process Active Tool Button ──
  btnProcess.addEventListener("click", () => {
    if (!activeSelectionText) return;

    if (currentTool === "optimize") {
      runOptimize();
      return;
    }

    btnProcess.disabled = true;
    btnProcess.classList.add("loading");
    outputText.classList.remove("hidden");
    optimizeResultsEl.classList.add("hidden");
    outputLabel.textContent = "Processing";
    outputLabel.className = "output-label";
    outputText.className = "output-text";
    outputText.innerHTML = `<div class="sinai-shimmer-line" style="width:96%"></div><div class="sinai-shimmer-line" style="width:88%"></div><div class="sinai-shimmer-line" style="width:60%"></div>`;
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

    callApi(endpoint, body)
      .then((data) => {
        btnProcess.disabled = false;
        btnProcess.classList.remove("loading");
        renderInlineResult(data);
      })
      .catch((err) => {
        btnProcess.disabled = false;
        btnProcess.classList.remove("loading");
        outputLabel.textContent = "Error";
        outputLabel.className = "output-label is-error";
        outputText.className = "output-text error";
        outputText.textContent = `API Error: ${err.message}`;
      });
  });

  // ── Render Inline Response (single-tool results) ──
  function renderInlineResult(data) {
    outputLabel.textContent = "Result";
    outputLabel.className = "output-label is-result";
    outputText.className = "output-text";
    inlineCorrectionsList.innerHTML = "";
    inlineCorrectionsList.classList.add("hidden");

    if (currentTool === "grammar") {
      outputText.textContent = data.corrected;

      if (data.corrections && data.corrections.length > 0) {
        inlineCorrectionsList.classList.remove("hidden");

        // The backend's substitution guard marks edits that look like a
        // different word rather than a fixed spelling — usually a swapped
        // name. Banner first: the card is small and scrolls, and a renamed
        // person must not be something the user scrolls past.
        const flagged = data.corrections.filter((c) => c.suspicious);
        if (flagged.length > 0) {
          const warn = document.createElement("div");
          warn.className = "inline-corr-warning";
          warn.textContent =
            flagged.length === 1
              ? "1 change may have replaced a word — check it below."
              : `${flagged.length} changes may have replaced words — check them below.`;
          inlineCorrectionsList.appendChild(warn);
        }

        data.corrections.forEach((c) => {
          const div = document.createElement("div");
          div.className = c.suspicious ? "inline-corr-item is-flagged" : "inline-corr-item";
          div.innerHTML = `
            <div class="inline-corr-comp">
              <span class="inline-corr-orig">${escapeHtml(c.original)}</span>
              <span class="inline-corr-arrow">➔</span>
              <span class="inline-corr-new">${escapeHtml(c.corrected)}</span>
            </div>
            ${
              c.suspicious
                ? `<div class="inline-corr-reason">${escapeHtml(
                    c.suspicious_reason || "Possible word replacement — verify against your source."
                  )}</div>`
                : ""
            }
          `;
          inlineCorrectionsList.appendChild(div);
        });
      } else {
        inlineCorrectionsList.classList.remove("hidden");
        inlineCorrectionsList.innerHTML = `<span style="color:#059669; font-size:11.5px; display:block; text-align:center;">No grammar issues found.</span>`;
      }
    } else if (currentTool === "headlines") {
      outputText.textContent = data.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
    } else if (currentTool === "rewriter") {
      outputText.textContent = data.rewritten;
    } else if (currentTool === "summarizer") {
      outputText.textContent = data.summary;
    }
  }

  // ── Optimize: real streaming pipeline via POST /optimize ──
  // One backend call, streamed as NDJSON, mirroring web-app's Optimize
  // Article. Replaces the old client-side chain of four separate tool
  // calls, which predated /optimize existing and could drift from the
  // server's own pipeline ordering/validation.
  const OPTIMIZE_STAGE_META = {
    grammar: "Grammar",
    style: "Style",
    headline: "Headlines",
    summary: "Summary"
  };

  function optimizeStages() {
    const stages = ["grammar"];
    if (optimizeOptions.restyle) stages.push("style");
    stages.push("headline");
    if (optimizeOptions.summarize) stages.push("summary");
    return stages;
  }

  function renderOptimizeSkeleton(stages) {
    optimizeResultsEl.classList.remove("hidden");
    outputText.classList.add("hidden");
    outputLabel.classList.add("hidden"); // each stage card carries its own status instead
    inlineCorrectionsList.classList.add("hidden");
    optimizeResultsEl.innerHTML = stages
      .map(
        (id) => `
        <div class="optimize-stage" data-stage="${id}">
          <div class="optimize-stage-head">
            ${OPTIMIZE_STAGE_META[id]}
            <span class="optimize-stage-status pending" data-role="status">Queued</span>
          </div>
          <div class="optimize-stage-body" data-role="body"></div>
        </div>
      `
      )
      .join("");
  }

  function setStageStatus(id, status) {
    const el = optimizeResultsEl.querySelector(`.optimize-stage[data-stage="${id}"] [data-role="status"]`);
    if (!el) return;
    el.className = `optimize-stage-status ${status}`;
    el.textContent =
      status === "running" ? "Running" :
      status === "done" ? "Done" :
      status === "failed" ? "Failed" :
      status === "skipped" ? "Skipped" : "Queued";
    const body = optimizeResultsEl.querySelector(`.optimize-stage[data-stage="${id}"] [data-role="body"]`);
    if (status === "running" && body) {
      body.innerHTML = `<div class="sinai-shimmer-line" style="width:90%"></div><div class="sinai-shimmer-line" style="width:70%"></div>`;
    }
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

  /**
   * Open a stream for POST /optimize over a long-lived Port to background.js
   * (only it gets a CORS exemption via host_permissions — see callApi
   * above). `onEvent` fires once per NDJSON object; `onDone`/`onError` fire
   * exactly once, at the end.
   */
  function openOptimizeStream(body, onEvent, onDone, onError) {
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
      // "heartbeat" needs no handling — it only keeps the service worker
      // alive while a stage is still running.
    });

    port.onDisconnect.addListener(() => {
      if (!finished) {
        finished = true;
        onError("Connection to the extension background was lost.");
      }
    });

    port.postMessage({ action: "startOptimize", body });
  }

  function setStageResult(id, text, isError) {
    const body = optimizeResultsEl.querySelector(`.optimize-stage[data-stage="${id}"] [data-role="body"]`);
    if (!body) return;
    body.innerHTML = "";
    body.textContent = text;
    body.style.color = isError ? "#ab1112" : "";
  }

  function runOptimize() {
    const stages = optimizeStages();
    renderOptimizeSkeleton(stages);
    btnProcess.disabled = true;
    btnProcess.classList.add("loading");

    let finalText = activeSelectionText;
    const seenStages = new Set();

    const body = {
      text: activeSelectionText,
      restyle: optimizeOptions.restyle,
      tone: optimizeOptions.tone,
      summarize: optimizeOptions.summarize,
      length: optimizeOptions.length,
      headline_count: apiSettings.defaultHeadlineCount,
      headline_category: "General",
      headline_length: "medium"
    };

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
          setStageStatus(event.stage, "running");
        } else if (event.status === "done") {
          setStageStatus(event.stage, "done");
          setStageResult(event.stage, optimizeStageText(event.stage, event.data));
        } else if (event.status === "skipped") {
          setStageStatus(event.stage, "skipped");
          setStageResult(
            event.stage,
            event.reason === "disabled" ? "This tool is currently switched off." : "Skipped."
          );
        } else if (event.status === "failed") {
          setStageStatus(event.stage, "failed");
          setStageResult(event.stage, event.error || "This stage failed.", true);
        }
      },
      () => {
        btnProcess.disabled = false;
        btnProcess.classList.remove("loading");
        outputText.textContent = finalText;
        outputText.className = "output-text hidden"; // kept in sync for Copy/Apply, not shown — the stage cards are the visible result
      },
      (errorMessage) => {
        btnProcess.disabled = false;
        btnProcess.classList.remove("loading");
        stages.forEach((id) => {
          if (!seenStages.has(id)) {
            setStageStatus(id, "failed");
            setStageResult(id, errorMessage, true);
          }
        });
      }
    );
  }

  // ── Copy Result ──
  btnCopy.addEventListener("click", () => {
    let copyText = outputText.textContent;
    if (!copyText || outputText.classList.contains("placeholder")) return;

    navigator.clipboard.writeText(copyText).then(() => {
      const originalSvg = btnCopy.innerHTML;
      btnCopy.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#059669" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
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

      const isEditable = activeTargetElement.tagName === "INPUT" || activeTargetElement.tagName === "TEXTAREA";

      if (isEditable) {
        const start = activeTargetElement.selectionStart;
        const end = activeTargetElement.selectionEnd;
        const text = activeTargetElement.value;

        try {
          document.execCommand("insertText", false, replacement);
        } catch (e) {
          activeTargetElement.value = text.substring(0, start) + replacement + text.substring(end);
        }
      } else {
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

      activeTargetElement = document.activeElement;

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        activeSelectionRange = selection.getRangeAt(0).cloneRange();
      }
      showCard();

      setTimeout(() => {
        btnProcess.click();
      }, 100);

      sendResponse({ success: true });
      return;
    }

    // Used by the popup: "give me whatever article this page extracted"
    // so the toolbar popup can show/run tools on it without the user
    // having to select text manually.
    if (message.action === "getPageArticle") {
      const article = extractArticleFromPage();
      sendResponse({
        success: true,
        article,
        hostname: window.location.hostname,
        url: window.location.href
      });
      return;
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
  // The site-specific selectors below are the ones this project's own
  // data-pipeline scrapers use to pull article bodies from these exact
  // sites (verified against Initial work/Scrappers/**), not guessed —
  // except the four marked below, which have no corresponding scraper and
  // are a best-effort guess based on the shared Wijeya Newspapers CMS.
  const SITE_EXTRACTORS = {
    "adaderana.lk": ".news-content, .story-text, .news-body",
    "hirunews.lk": ".description-content, .article-content, .news-content",
    "mawbima.lk": ".td-post-content, .entry-content, article",
    "vikalpa.org": ".entry-content, article, .post-content",
    "itn.lk": ".entry-content",
    "vidusara.lk": ".entry-content",
    // Unverified — no project scraper for these; same CMS family as a guess.
    "lankadeepa.lk": ".entry-content, .post-content",
    "divaina.lk": ".entry-content",
    "dinamina.lk": ".entry-content",
    "silumina.lk": ".entry-content"
  };

  // Tried on any site not in SITE_EXTRACTORS (or where the specific
  // selector found nothing) so the popup's "fetch this article" affordance
  // isn't limited to the ten sites above.
  const GENERIC_ARTICLE_SELECTORS =
    "article, [role='main'] article, .entry-content, .post-content, .article-content, .article-body, main article";

  function findArticleElement() {
    const hostname = window.location.hostname;

    for (const [domain, selector] of Object.entries(SITE_EXTRACTORS)) {
      if (hostname.includes(domain)) {
        const el = document.querySelector(selector);
        if (el && el.innerText.trim().length > 100) return el;
        break; // matched a known site but its markup didn't match — fall through to generic
      }
    }

    return document.querySelector(GENERIC_ARTICLE_SELECTORS);
  }

  /** Returns { text, title } for the current page, or null if nothing usable was found. */
  function extractArticleFromPage() {
    const el = findArticleElement();
    if (!el || el.innerText.trim().length < 100) return null;

    const titleEl = document.querySelector("h1");
    return {
      text: el.innerText.trim(),
      title: titleEl ? titleEl.innerText.trim() : document.title
    };
  }

  function autoProcessArticle() {
    const article = extractArticleFromPage();
    if (!article) return;

    activeSelectionText = article.text;

    chrome.runtime.sendMessage({ action: "updateBadge", text: "1" }).catch(() => {});

    const badgeWidth = 36;
    const badgeHeight = 36;
    const left = window.innerWidth - badgeWidth - 30 + window.scrollX;
    const top = window.innerHeight - badgeHeight - 30 + window.scrollY;

    badge.style.left = `${left}px`;
    badge.style.top = `${top}px`;
    badge.style.position = "fixed";
    badge.style.display = "";
    badge.classList.remove("hidden");
  }

  window.addEventListener("load", () => {
    setTimeout(autoProcessArticle, 1000);
  });
})();
