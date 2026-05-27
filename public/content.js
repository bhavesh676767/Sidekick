// Sidekick page runtime: DOM tools + persistent floating notch UI.

console.log("Sidekick content runtime loaded");

if (!window.__sidekickContentRuntimeLoaded) {
  window.__sidekickContentRuntimeLoaded = true;

  const SIDEKICK_STORAGE_DEFAULTS = {
    sidekickEnabled: false,
    notchPosition: { x: null, y: null },
    notchCollapsed: true,
    voiceEnabled: false,
    voiceMode: "text",
    wakeWord: "sidekick",
    autoSpeak: false,
    speechRate: 1,
    lastState: "idle",
    sidekickTheme: "light"
  };

  const SIDEKICK_IDS = {
    root: "sidekick-floating-notch-root",
    style: "sidekick-floating-notch-style"
  };

  const QUICK_ACTIONS = [
    { label: "Summarize", command: "summarize page" },
    { label: "YouTube", command: "open youtube" },
    { label: "Scroll down", command: "scroll down" },
    { label: "Search web", command: "google search " }
  ];

  let uiState = {
    sidekickEnabled: false,
    notchPosition: { x: null, y: null },
    notchCollapsed: true,
    voiceEnabled: false,
    voiceMode: "text",
    wakeWord: "sidekick",
    autoSpeak: false,
    speechRate: 1,
    lastState: "idle",
    sidekickTheme: "light"
  };

  let agentState = {
    command: "",
    isRunning: false,
    currentAction: "Idle",
    result: null,
    logs: [],
    askUserQuestion: null,
    suggestedFollowup: null
  };

  let voiceState = {
    mode: "idle",
    transcript: "",
    lastResponse: "",
    error: null
  };

  let rootEl = null;
  let currentTranscript = "";
  let dragState = null;
  let clockTimer = null;
  let assistTipState = {
    loaded: false,
    dismissedFormTooltipSites: [],
    dismissedWritingTooltipSites: [],
    formDismissCountBySite: {},
    writingDismissCountBySite: {},
    activeTip: null
  };

  function getSiteKey() {
    return window.location.hostname.replace(/^www\./, "");
  }

  async function loadAssistTipState() {
    if (assistTipState.loaded) return assistTipState;
    const stored = await chrome.storage.local.get("sidekickMemory").catch(() => ({}));
    const preferences = stored.sidekickMemory?.preferences || {};
    assistTipState = {
      ...assistTipState,
      loaded: true,
      dismissedFormTooltipSites: preferences.dismissedFormTooltipSites || [],
      dismissedWritingTooltipSites: preferences.dismissedWritingTooltipSites || [],
      formDismissCountBySite: preferences.formDismissCountBySite || {},
      writingDismissCountBySite: preferences.writingDismissCountBySite || {}
    };
    return assistTipState;
  }

  async function dismissAssistTip(kind) {
    const site = getSiteKey();
    const stored = await chrome.storage.local.get("sidekickMemory").catch(() => ({}));
    const memory = stored.sidekickMemory || {};
    const preferences = memory.preferences || {};
    const countKey = kind === "form" ? "formDismissCountBySite" : "writingDismissCountBySite";
    const listKey = kind === "form" ? "dismissedFormTooltipSites" : "dismissedWritingTooltipSites";
    const nextCounts = { ...(preferences[countKey] || {}) };
    nextCounts[site] = (nextCounts[site] || 0) + 1;
    const nextList = new Set(preferences[listKey] || []);
    if (kind === "form" || nextCounts[site] >= 2) nextList.add(site);
    const nextMemory = {
      ...memory,
      preferences: {
        ...preferences,
        [countKey]: nextCounts,
        [listKey]: Array.from(nextList)
      }
    };
    await chrome.storage.local.set({ sidekickMemory: nextMemory });
    assistTipState.activeTip = null;
    assistTipState[countKey] = nextCounts;
    assistTipState[listKey] = Array.from(nextList);
    renderNotch();
  }

  function isElementVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  var skIdCounter = 1;
  function getOrAssignSidekickId(el) {
    let id = el.getAttribute("data-sidekick-id");
    if (!id) {
      id = `sk-${skIdCounter++}`;
      el.setAttribute("data-sidekick-id", id);
    }
    return id;
  }

  function findBestMatch(elements, targetText) {
    if (!targetText) return null;
    const records = elements
      .filter(isElementVisible)
      .map((el) => ({
        el,
        text: (el.innerText || el.value || "").trim(),
        ariaLabel: el.getAttribute("aria-label") || "",
        placeholder: el.getAttribute("placeholder") || "",
        title: el.getAttribute("title") || "",
        label: getElementTextSignature(el),
        id: el.id || "",
        sidekickId: el.getAttribute("data-sidekick-id") || ""
      }));
    const fuzzyMatch = window.SidekickLibs?.fuzzyFind?.(records, targetText, ["text", "ariaLabel", "placeholder", "title", "label", "id", "sidekickId"]);
    if (fuzzyMatch?.el) return fuzzyMatch.el;

    const target = targetText.toLowerCase().trim();
    let bestElement = null;
    let bestScore = -1;

    for (const el of elements) {
      if (!isElementVisible(el)) continue;

      const elText = (el.innerText || el.value || "").toLowerCase().trim();
      const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase().trim();
      const placeholder = (el.getAttribute("placeholder") || "").toLowerCase().trim();
      const title = (el.getAttribute("title") || "").toLowerCase().trim();
      const id = (el.id || "").toLowerCase().trim();
      const skId = (el.getAttribute("data-sidekick-id") || "").toLowerCase().trim();

      let score = 0;
      if (elText === target) score = 100;
      else if (ariaLabel === target) score = 95;
      else if (placeholder === target) score = 90;
      else if (title === target) score = 85;
      else if (id === target) score = 80;
      else if (skId === target) score = 75;
      else if (elText.includes(target)) score = 70;
      else if (ariaLabel.includes(target)) score = 65;
      else if (placeholder.includes(target)) score = 60;
      else if (title.includes(target)) score = 55;
      else {
        const elWords = elText.split(/\s+/);
        const targetWords = target.split(/\s+/);
        let overlaps = 0;
        for (const word of targetWords) {
          if (word && elWords.includes(word)) overlaps += 1;
        }
        if (overlaps > 0) score = 10 + (overlaps / Math.max(elWords.length, 1)) * 20;
      }

      if (score > bestScore && score > 0) {
        bestScore = score;
        bestElement = el;
      }
    }

    return bestElement;
  }

  function getPageContext() {
    const body = document.body;
    if (!body) {
      return {
        url: window.location.href,
        title: document.title,
        visibleText: "",
        buttons: [],
        links: [],
        inputs: [],
        headings: []
      };
    }

    const getCompactAttributes = (el, type) => ({
      id: getOrAssignSidekickId(el),
      type,
      text: (el.innerText || el.value || el.placeholder || el.getAttribute("aria-label") || "").trim().substring(0, 50)
    });

    return {
      url: window.location.href,
      title: document.title,
      visibleText: (body.innerText || body.textContent || "").substring(0, 1200),
      buttons: Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']")).filter(isElementVisible).slice(0, 20).map((el) => getCompactAttributes(el, "button")),
      links: Array.from(document.querySelectorAll("a")).filter(isElementVisible).slice(0, 20).map((el) => getCompactAttributes(el, "link")),
      inputs: Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']")).filter(isElementVisible).slice(0, 12).map((el) => getCompactAttributes(el, "input")),
      headings: Array.from(document.querySelectorAll("h1, h2, h3, h4")).filter(isElementVisible).slice(0, 10).map((el) => ({ tag: el.tagName.toLowerCase(), text: el.innerText.trim().substring(0, 60) }))
    };
  }

  function getReadablePage() {
    const readable = window.SidekickLibs?.parseReadableDocument?.(document);
    if (readable?.textContent) {
      return {
        ...readable,
        url: window.location.href
      };
    }
    return {
      title: document.title,
      url: window.location.href,
      textContent: (document.body?.innerText || "").replace(/\s+/g, " ").trim().substring(0, 12000),
      excerpt: ""
    };
  }

  function getElementRole(el) {
    const explicitRole = el.getAttribute("role");
    if (explicitRole) return explicitRole;
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();
    if (tag === "button" || type === "button" || type === "submit") return "button";
    if (tag === "a") return "link";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "search") return "searchbox";
      return "textbox";
    }
    if (el.hasAttribute("contenteditable")) return "textbox";
    if (/^h[1-6]$/.test(tag)) return "heading";
    return tag;
  }

  function getElementTextSignature(el) {
    const parts = [
      el.innerText,
      el.value,
      el.placeholder,
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
      el.getAttribute("alt"),
      el.name,
      el.id
    ];
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label?.innerText) parts.push(label.innerText);
    }
    const wrappingLabel = el.closest("label");
    if (wrappingLabel?.innerText) parts.push(wrappingLabel.innerText);
    return [...new Set(parts.filter(Boolean).map((part) => String(part).replace(/\s+/g, " ").trim()))].join(" | ").substring(0, 180);
  }

  function getDomPerception() {
    const selectors = [
      "a[href]",
      "button",
      "[role='button']",
      "[role='link']",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[contenteditable='true']",
      "[tabindex]",
      "summary",
      "label",
      "h1",
      "h2",
      "h3",
      "h4"
    ].join(",");
    const viewport = { width: window.innerWidth, height: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY };
    const elements = Array.from(document.querySelectorAll(selectors))
      .filter(isElementVisible)
      .slice(0, 180)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const id = getOrAssignSidekickId(el);
        const role = getElementRole(el);
        const tag = el.tagName.toLowerCase();
        const type = (el.type || "").toLowerCase();
        return {
          id,
          tag,
          role,
          type,
          text: getElementTextSignature(el),
          placeholder: el.placeholder || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          title: el.getAttribute("title") || "",
          href: el.href || "",
          enabled: !el.disabled && el.getAttribute("aria-disabled") !== "true",
          checked: Boolean(el.checked),
          bounds: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            centerX: Math.round(rect.left + rect.width / 2),
            centerY: Math.round(rect.top + rect.height / 2)
          }
        };
      });
    return {
      url: window.location.href,
      title: document.title,
      viewport,
      elements,
      note: "DOM perception only. No screenshot or paid vision model was used."
    };
  }

  function getFieldLabel(el) {
    const labels = [];
    if (el.id) {
      const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (explicit?.innerText) labels.push(explicit.innerText.trim());
    }
    const wrapping = el.closest("label");
    if (wrapping?.innerText) labels.push(wrapping.innerText.trim());
    const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (aria) labels.push(aria);
    const nearby = el.closest("div, p, li, section, form");
    if (nearby) {
      const labelLike = nearby.querySelector("label, .label, [class*='label' i]");
      if (labelLike?.innerText) labels.push(labelLike.innerText.trim());
    }
    labels.push(el.placeholder || el.name || el.id || "");
    return labels.find(Boolean)?.replace(/\s+/g, " ").substring(0, 90) || "Unlabeled field";
  }

  function isSensitiveField(el) {
    const text = `${el.type || ""} ${el.name || ""} ${el.id || ""} ${el.placeholder || ""} ${getFieldLabel(el)}`.toLowerCase();
    return /(password|passcode|card|cvv|cvc|payment|address|phone|mobile|aadhaar|aadhar|pan|ssn|government|passport|license)/.test(text);
  }

  function getFormFields() {
    const fields = [];
    const selectors = "input:not([type='hidden']), textarea, select, [contenteditable='true']";
    Array.from(document.querySelectorAll(selectors)).forEach((el) => {
      if (!isElementVisible(el) || el.disabled || el.readOnly) return;
      const tag = el.tagName.toLowerCase();
      const type = (el.type || tag).toLowerCase();
      const optionValues = tag === "select"
        ? Array.from(el.options).map((option) => ({ value: option.value, text: option.text })).slice(0, 30)
        : type === "radio"
          ? Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name || "")}"]`)).map((radio) => ({ id: getOrAssignSidekickId(radio), value: radio.value, label: getFieldLabel(radio) })).slice(0, 20)
          : [];
      fields.push({
        id: getOrAssignSidekickId(el),
        label: getFieldLabel(el),
        tag,
        type,
        name: el.name || "",
        placeholder: el.placeholder || "",
        value: el.value || el.innerText || "",
        checked: Boolean(el.checked),
        required: Boolean(el.required || el.getAttribute("aria-required") === "true"),
        sensitive: isSensitiveField(el),
        options: optionValues
      });
    });
    return fields;
  }

  function detectFormSummary() {
    const fields = getFormFields();
    const submitButtons = Array.from(document.querySelectorAll("button, input[type='submit'], [role='button']"))
      .filter(isElementVisible)
      .filter((el) => /submit|send|apply|save|continue|next|post|publish|sign up|register/i.test(el.innerText || el.value || el.getAttribute("aria-label") || ""))
      .slice(0, 8)
      .map((el) => ({ id: getOrAssignSidekickId(el), text: (el.innerText || el.value || el.getAttribute("aria-label") || "").trim() }));
    return {
      hasForm: fields.length >= 2 || Boolean(document.querySelector("form") && fields.length),
      fieldCount: fields.length,
      fields,
      submitButtons
    };
  }

  function detectWritingSurface() {
    const writingFields = getFormFields().filter((field) => {
      const text = `${field.label} ${field.placeholder} ${field.type}`.toLowerCase();
      return field.tag === "textarea" || field.tag === "div" || field.type === "textarea" || /compose|reply|comment|message|description|bio|post|editor|document/.test(text);
    });
    return {
      hasWritingSurface: writingFields.some((field) => {
        const el = document.querySelector(`[data-sidekick-id="${field.id}"]`);
        const rect = el?.getBoundingClientRect();
        return rect && (rect.height > 70 || rect.width > 300);
      }),
      fields: writingFields
    };
  }

  async function refreshAssistTip() {
    await loadAssistTipState();
    if (!uiState.sidekickEnabled || agentState.isRunning || agentState.askUserQuestion) return;
    const site = getSiteKey();
    if (!assistTipState.dismissedFormTooltipSites.includes(site) && detectFormSummary().hasForm) {
      assistTipState.activeTip = { kind: "form", text: "Need help filling this?", command: "Fill this form" };
    } else if (!assistTipState.dismissedWritingTooltipSites.includes(site) && detectWritingSurface().hasWritingSurface) {
      assistTipState.activeTip = { kind: "writing", text: /mail\.google|linkedin|reddit|x\.com|twitter/.test(location.hostname) ? "Need a better reply?" : "Want help writing?", command: "Help me write here" };
    } else {
      assistTipState.activeTip = null;
    }
    renderNotch();
  }

  function simulateClick(el) {
    el.focus();
    ["mousedown", "click", "mouseup"].forEach((trigger) => {
      const event = new MouseEvent(trigger, { bubbles: true, cancelable: true, view: window });
      el.dispatchEvent(event);
    });
  }

  function setFieldValue(el, value) {
    el.focus();
    if (el.hasAttribute("contenteditable")) {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
    } else if (el.type === "checkbox" || el.type === "radio") {
      el.checked = Boolean(value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getFieldById(fieldId) {
    return fieldId ? document.querySelector(`[data-sidekick-id="${CSS.escape(fieldId)}"]`) : null;
  }

  function reviewFormValues() {
    return getFormFields().map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      value: field.sensitive ? (field.value ? "[filled sensitive value]" : "") : field.value,
      checked: field.checked,
      required: field.required,
      sensitive: field.sensitive
    }));
  }

  function parseTimestampToSeconds(str) {
    if (!str) return null;
    const clean = str.toLowerCase().trim();
    const colons = clean.split(":");
    if (colons.length > 1) {
      let secs = 0;
      if (colons.length === 3) {
        secs += parseInt(colons[0], 10) * 3600;
        secs += parseInt(colons[1], 10) * 60;
        secs += parseInt(colons[2], 10);
      } else if (colons.length === 2) {
        secs += parseInt(colons[0], 10) * 60;
        secs += parseInt(colons[1], 10);
      }
      if (!isNaN(secs)) return secs;
    }

    let totalSeconds = 0;
    const hrMatch = clean.match(/(\d+)\s*(?:hour|hr|h)/);
    const minMatch = clean.match(/(\d+)\s*(?:minute|min|m)/);
    const secMatch = clean.match(/(\d+)\s*(?:second|sec|s)/);
    if (hrMatch) totalSeconds += parseInt(hrMatch[1], 10) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1], 10);
    if (totalSeconds > 0) return totalSeconds;

    const rawDigits = clean.match(/^\d+$/);
    return rawDigits ? parseInt(clean, 10) : null;
  }

  function seekToChapter(chapterName) {
    const lower = chapterName.toLowerCase().trim();
    const chapters = Array.from(document.querySelectorAll(".ytp-chapter-title, ytd-macro-markers-list-item-renderer, a[href*='t=']"));
    const match = chapters.find((el) => el.innerText.toLowerCase().includes(lower));
    if (match) {
      match.click();
      return true;
    }
    return false;
  }

  function extractProductCards() {
    const products = [];
    const hostname = window.location.hostname.toLowerCase();
    const platform =
      hostname.includes("amazon.") ? "Amazon India" :
      hostname.includes("flipkart.") ? "Flipkart" :
      hostname.includes("myntra.") ? "Myntra" :
      hostname.includes("ajio.") ? "Ajio" :
      hostname.includes("croma.") ? "Croma" :
      hostname.includes("reliancedigital.") ? "Reliance Digital" :
      hostname.includes("meesho.") ? "Meesho" :
      hostname.includes("tatacliq.") ? "Tata CLiQ" :
      hostname.includes("pepperfry.") ? "Pepperfry" :
      hostname.includes("ikea.") ? "IKEA India" :
      "Marketplace";
    let cards = Array.from(document.querySelectorAll('[data-component-type="s-search-result"], .s-result-item, .s-item, [class*="product-card" i], [class*="product-item" i]'));
    if (cards.length === 0) {
      cards = Array.from(document.querySelectorAll(".s-item, .product-layout, .grid-item, [class*='card' i]"));
    }

    for (const card of cards) {
      if (!isElementVisible(card)) continue;
      const titleEl = card.querySelector("h2, h3, [class*='title' i], .s-line-clamp-2, a.a-link-normal span");
      if (!titleEl) continue;
      const title = titleEl.innerText.trim();
      if (!title || title.length < 5) continue;

      let price = "";
      const priceEl = card.querySelector(".a-price-whole, .a-price, .price, [class*='price' i], .s-item__price");
      if (priceEl) price = priceEl.innerText.trim().replace(/\n/g, ".");
      else {
        const match = card.innerText.match(/(?:₹|\$|Rs\.?|INR)\s*[\d,.]+(?:\.\d{1,2})?/i);
        if (match) price = match[0];
      }
      if (!price) continue;

      let rating = "";
      const ratingEl = card.querySelector(".a-icon-alt, [class*='rating' i], .s-item__stars");
      if (ratingEl) rating = ratingEl.innerText.trim();
      else {
        const ratingMatch = card.innerHTML.match(/(\d+(?:\.\d+)?)\s*(?:out of )?5\s*stars/i);
        if (ratingMatch) rating = `${ratingMatch[1]}/5`;
      }

      const reviewsEl = card.querySelector(".a-size-base, [class*='reviews' i], [class*='review-count' i]");
      const linkEl = card.querySelector("a[href*='/dp/'], a[href*='/itm/'], a[class*='link' i], h2 a, a");
      const imgEl = card.querySelector("img.s-image, img.product-image, img");
      const url = linkEl ? new URL(linkEl.getAttribute("href"), window.location.href).href : "";
      const id = linkEl ? getOrAssignSidekickId(linkEl) : getOrAssignSidekickId(card);
      const priceInfo = window.SidekickLibs?.normalizePrice?.(price) || {};
      const priceValue = Number.isFinite(priceInfo.value) ? priceInfo.value : parsePriceToNumber(price);
      const ratingValue = parseFloat(String(rating || "").match(/[\d.]+/)?.[0] || "0");
      const reviewsCount = parseInt(String(reviewsEl ? reviewsEl.innerText : "").replace(/[^\d]/g, ""), 10) || 0;

      products.push({
        id,
        title,
        price,
        priceValue,
        rating,
        ratingValue,
        reviews: reviewsEl ? reviewsEl.innerText.trim() : "",
        reviewsCount,
        url,
        href: url,
        image: imgEl ? imgEl.src : "",
        imageSrc: imgEl ? imgEl.src : "",
        platform
      });
    }

    return (window.SidekickLibs?.rankProducts?.(products, document.title) || products).slice(0, 20);
  }

  function extractSearchResults() {
    const selectors = [
      "div.g a[href] h3",
      "a h3",
      "[data-testid='result'] a[href]",
      "li.b_algo h2 a",
      ".yuRUbf a[href]"
    ];
    const results = [];
    const seen = new Set();

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const anchor = node.closest("a") || node;
        const href = anchor.href;
        const text = (node.innerText || anchor.innerText || "").trim();
        if (!href || !text || seen.has(href)) return;
        seen.add(href);
        results.push({
          id: getOrAssignSidekickId(anchor),
          text,
          href,
          title: text,
          domain: new URL(href).hostname.replace(/^www\./, ""),
          visible: isElementVisible(anchor),
          ariaLabel: anchor.getAttribute("aria-label") || "",
          source: window.location.hostname.includes("bing.") ? "bing" : "google"
        });
      });
    });

    return results.filter((item) => item.visible).slice(0, 20);
  }

  function parsePriceToNumber(priceStr) {
    if (!priceStr) return Infinity;
    const normalized = window.SidekickLibs?.normalizePrice?.(priceStr);
    if (Number.isFinite(normalized?.value)) return normalized.value;
    const clean = priceStr.replace(/[^\d.]/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? Infinity : parsed;
  }

  async function readUiState() {
    const stored = await chrome.storage.local.get(Object.keys(SIDEKICK_STORAGE_DEFAULTS));
    return {
      sidekickEnabled: stored.sidekickEnabled ?? SIDEKICK_STORAGE_DEFAULTS.sidekickEnabled,
      notchPosition: stored.notchPosition || SIDEKICK_STORAGE_DEFAULTS.notchPosition,
      notchCollapsed: stored.notchCollapsed ?? SIDEKICK_STORAGE_DEFAULTS.notchCollapsed,
      voiceEnabled: stored.voiceEnabled ?? SIDEKICK_STORAGE_DEFAULTS.voiceEnabled,
      voiceMode: stored.voiceMode || SIDEKICK_STORAGE_DEFAULTS.voiceMode,
      wakeWord: stored.wakeWord || SIDEKICK_STORAGE_DEFAULTS.wakeWord,
      autoSpeak: stored.autoSpeak ?? SIDEKICK_STORAGE_DEFAULTS.autoSpeak,
      speechRate: stored.speechRate || SIDEKICK_STORAGE_DEFAULTS.speechRate,
      lastState: stored.lastState || SIDEKICK_STORAGE_DEFAULTS.lastState,
      sidekickTheme: stored.sidekickTheme || SIDEKICK_STORAGE_DEFAULTS.sidekickTheme
    };
  }

  function ensureStyles() {
    if (document.getElementById(SIDEKICK_IDS.style)) return;
    const style = document.createElement("style");
    style.id = SIDEKICK_IDS.style;
    style.textContent = `
      #${SIDEKICK_IDS.root} {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483647;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #171711;
      }
      #${SIDEKICK_IDS.root} * { box-sizing: border-box; }
      .sk-notch-shell {
        position: fixed;
        min-width: 56px;
        min-height: 56px;
        border-radius: 999px;
        background: #fffdf6;
        border: 1px solid rgba(32,30,22,0.12);
        box-shadow: 0 16px 34px rgba(47,43,31,0.14);
        backdrop-filter: blur(18px);
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow: hidden;
        user-select: none;
      }
      .sk-theme-dark .sk-notch-shell {
        background: #23231f;
        border-color: rgba(255,255,255,0.10);
        box-shadow: 0 18px 38px rgba(0,0,0,0.34);
        color: #f5f1e7;
      }
      .sk-notch-shell.sk-collapsed {
        width: 56px;
        height: 56px;
      }
      .sk-notch-shell.sk-expanded {
        width: 320px;
        border-radius: 26px;
      }
      .sk-notch-pill {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        cursor: grab;
        position: relative;
        color: #11120a;
        background: #dfff14;
      }
      .sk-notch-pill:active { cursor: grabbing; }
      .sk-notch-state-ring {
        position: absolute;
        inset: 7px;
        border-radius: 999px;
        border: 1px solid rgba(17,18,10,0.12);
      }
      .sk-notch-pill.sk-listening .sk-notch-state-ring,
      .sk-notch-pill.sk-speaking .sk-notch-state-ring {
        animation: sk-pulse 1.25s ease-in-out infinite;
      }
      .sk-notch-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 0 12px 12px 12px;
      }
      .sk-notch-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 12px 0;
      }
      .sk-notch-title {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(23,23,17,0.46);
        font-weight: 900;
      }
      .sk-theme-dark .sk-notch-title { color: rgba(245,241,231,0.50); }
      .sk-notch-status {
        font-size: 10px;
        color: rgba(23,23,17,0.70);
        font-weight: 800;
      }
      .sk-theme-dark .sk-notch-status { color: rgba(245,241,231,0.76); }
      .sk-notch-close {
        border: 0;
        background: rgba(23,23,17,0.08);
        color: rgba(23,23,17,0.72);
        width: 28px;
        height: 28px;
        border-radius: 999px;
        cursor: pointer;
      }
      .sk-theme-dark .sk-notch-close { background: rgba(255,255,255,0.08); color: rgba(245,241,231,0.75); }
      .sk-notch-transcript,
      .sk-notch-response {
        border-radius: 18px;
        background: rgba(236,230,214,0.68);
        border: 1px solid rgba(32,30,22,0.10);
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.45;
        color: rgba(23,23,17,0.86);
        font-weight: 650;
      }
      .sk-theme-dark .sk-notch-transcript,
      .sk-theme-dark .sk-notch-response {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.08);
        color: rgba(245,241,231,0.88);
      }
      .sk-notch-transcript {
        min-height: 46px;
        color: rgba(23,23,17,0.58);
      }
      .sk-theme-dark .sk-notch-transcript { color: rgba(245,241,231,0.58); }
      .sk-notch-response {
        min-height: 58px;
        max-height: 180px;
        overflow-y: auto;
      }
      .sk-notch-input-row {
        display: grid;
        grid-template-columns: 1fr auto auto;
        gap: 8px;
      }
      .sk-notch-input-row-text {
        grid-template-columns: 1fr auto;
      }
      .sk-notch-input {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(32,30,22,0.12);
        background: #f6f1e6;
        color: #171711;
        padding: 10px 12px;
        outline: none;
        font-size: 12px;
        font-weight: 700;
      }
      .sk-theme-dark .sk-notch-input {
        background: #171714;
        border-color: rgba(255,255,255,0.10);
        color: #f5f1e7;
      }
      .sk-notch-input::placeholder { color: rgba(23,23,17,0.34); }
      .sk-theme-dark .sk-notch-input::placeholder { color: rgba(245,241,231,0.28); }
      .sk-notch-btn {
        border: 0;
        cursor: pointer;
        border-radius: 16px;
        padding: 0 12px;
        min-width: 42px;
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 900;
        transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
      }
      .sk-notch-btn:active { transform: scale(0.97); }
      .sk-notch-btn:disabled { opacity: 0.35; cursor: default; }
      .sk-notch-btn-primary { background: #dfff14; color: #11120a; }
      .sk-notch-btn-secondary { background: rgba(23,23,17,0.08); color: #171711; }
      .sk-theme-dark .sk-notch-btn-secondary { background: rgba(255,255,255,0.08); color: #f5f1e7; }
      .sk-notch-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .sk-notch-chip {
        border: 1px solid rgba(32,30,22,0.10);
        background: rgba(236,230,214,0.70);
        color: rgba(23,23,17,0.74);
        border-radius: 999px;
        padding: 7px 10px;
        font-size: 10px;
        font-weight: 850;
        cursor: pointer;
      }
      .sk-theme-dark .sk-notch-chip {
        border-color: rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.07);
        color: rgba(245,241,231,0.78);
      }
      .sk-assist-tip {
        position: absolute;
        right: 0;
        bottom: calc(100% + 8px);
        width: max-content;
        max-width: 210px;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(10,10,10,0.94);
        color: rgba(255,255,255,0.86);
        box-shadow: 0 12px 30px rgba(0,0,0,0.24);
        backdrop-filter: blur(14px);
        border-radius: 999px;
        padding: 7px 8px 7px 10px;
        font-size: 11px;
        line-height: 1;
      }
      .sk-assist-tip button {
        border: 0;
        border-radius: 999px;
        cursor: pointer;
        color: inherit;
        background: rgba(255,255,255,0.08);
        min-width: 22px;
        height: 22px;
        font-size: 10px;
      }
      .sk-assist-tip [data-sk-tip-action="accept"] {
        background: #fff;
        color: #000;
        padding: 0 8px;
      }
      .sk-notch-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .sk-notch-mini {
        font-size: 10px;
        color: rgba(23,23,17,0.42);
        font-weight: 800;
      }
      .sk-theme-dark .sk-notch-mini { color: rgba(245,241,231,0.42); }
      .sk-wave {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        height: 18px;
      }
      .sk-wave span {
        width: 3px;
        border-radius: 999px;
        background: #fff;
        animation: sk-wave 0.9s ease-in-out infinite;
      }
      .sk-wave span:nth-child(1) { height: 8px; }
      .sk-wave span:nth-child(2) { height: 14px; animation-delay: .12s; }
      .sk-wave span:nth-child(3) { height: 10px; animation-delay: .24s; }
      .sk-wave span:nth-child(4) { height: 16px; animation-delay: .36s; }
      .sk-dot-loader {
        display: inline-flex;
        gap: 4px;
      }
      .sk-dot-loader span {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #fff;
        opacity: .3;
        animation: sk-dots 1.1s ease-in-out infinite;
      }
      .sk-dot-loader span:nth-child(2) { animation-delay: .15s; }
      .sk-dot-loader span:nth-child(3) { animation-delay: .3s; }
      @keyframes sk-pulse {
        0%, 100% { transform: scale(0.96); opacity: .36; }
        50% { transform: scale(1.08); opacity: 1; }
      }
      @keyframes sk-wave {
        0%, 100% { transform: scaleY(.7); opacity: .45; }
        50% { transform: scaleY(1.06); opacity: 1; }
      }
      @keyframes sk-dots {
        0%, 100% { transform: translateY(0); opacity: .25; }
        50% { transform: translateY(-4px); opacity: 1; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getViewportPosition(position) {
    const width = uiState.notchCollapsed ? 56 : 320;
    const height = uiState.notchCollapsed ? 56 : 360;
    const margin = 18;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    const fallbackX = Math.max(margin, window.innerWidth - width - 22);
    const fallbackY = Math.max(margin, window.innerHeight - height - 22);
    return {
      x: typeof position?.x === "number" ? Math.min(Math.max(margin, position.x), maxX) : fallbackX,
      y: typeof position?.y === "number" ? Math.min(Math.max(margin, position.y), maxY) : fallbackY
    };
  }

  function setRootPosition() {
    if (!rootEl) return;
    const { x, y } = getViewportPosition(uiState.notchPosition);
    rootEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  function stopSpeaking() {
  }

  function speakResponse(text, options = {}) {
    return false;
  }

  function stopListening(silent) {
  }

  function handleVoiceTranscript(text) {
    if (!text) return;
    stopSpeaking();
    voiceState.transcript = text;
    chrome.runtime.sendMessage({ action: "VOICE_STATE", voiceState: { mode: "processing", transcript: text } });

    if (agentState.suggestedFollowup) {
      chrome.runtime.sendMessage({
        action: "FOLLOWUP_RESPONSE",
        response: text,
        followupKey: agentState.suggestedFollowup.key,
        suggestedCommand: agentState.suggestedFollowup.suggestedCommand
      });
      return;
    }

    if (agentState.askUserQuestion) {
      chrome.runtime.sendMessage({ action: "USER_RESPONSE", response: text });
      return;
    }

    chrome.runtime.sendMessage({ action: "START_AGENT", command: text, source: "voice" });
  }

  function saveCollapsed(collapsed) {
    uiState.notchCollapsed = collapsed;
    chrome.runtime.sendMessage({ action: "SET_NOTCH_COLLAPSED", collapsed });
  }

  function savePosition(position) {
    uiState.notchPosition = position;
    chrome.runtime.sendMessage({ action: "SAVE_NOTCH_POSITION", position });
  }

  function toggleExpanded(forceCollapsed) {
    const collapsed = typeof forceCollapsed === "boolean" ? forceCollapsed : !uiState.notchCollapsed;
    saveCollapsed(collapsed);
    renderNotch();
  }

  function destroyNotch() {
    stopSpeaking();
    stopListening();
    if (rootEl) rootEl.remove();
    rootEl = null;
  }

  function createWaveMarkup() {
    return `<span class="sk-wave"><span></span><span></span><span></span><span></span></span>`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNotchTime() {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date());
  }

  function getStatusLabel(stateLabel) {
    if (agentState.askUserQuestion) return "Asking";
    if (agentState.result?.text) return "Showing";
    if (agentState.isRunning || voiceState.mode === "processing") return "Working";
    if (voiceState.mode === "error") return "Needs help";
    return stateLabel === "Idle" ? "Idle" : stateLabel;
  }

  function createStateIcon() {
    const mode = voiceState.mode;
    if (mode === "processing" || agentState.isRunning) return `<span class="sk-dot-loader"><span></span><span></span><span></span></span>`;
    if (mode === "error") return `<span style="font-size:16px;">!</span>`;
    return `<img src="${chrome.runtime.getURL("sidekick_logo.png")}" alt="" style="width:30px;height:30px;border-radius:999px;object-fit:cover;" />`;
  }

  function renderNotch() {
    if (!uiState.sidekickEnabled) {
      destroyNotch();
      return;
    }

    ensureStyles();
    if (!rootEl) {
      rootEl = document.createElement("div");
      rootEl.id = SIDEKICK_IDS.root;
      document.documentElement.appendChild(rootEl);
    }

    const collapsed = uiState.notchCollapsed;
    const responseText = voiceState.lastResponse || agentState.result?.text || agentState.currentAction || "Ready.";
    const transcript = voiceState.transcript || currentTranscript || (agentState.askUserQuestion || "");
    const stateLabel = voiceState.mode === "speaking"
      ? "Speaking"
      : voiceState.mode === "listening"
        ? "Listening"
        : voiceState.mode === "wake_listening"
          ? "Wake listening"
        : agentState.isRunning || voiceState.mode === "processing"
          ? "Processing"
          : voiceState.mode === "error"
            ? "Error"
            : "Idle";

    const themeClass = uiState.sidekickTheme === "dark" ? "sk-theme-dark" : "sk-theme-light";
    rootEl.innerHTML = `
      <div class="sk-notch-shell ${themeClass} ${collapsed ? "sk-collapsed" : "sk-expanded"}">
        ${assistTipState.activeTip && collapsed ? `
          <div class="sk-assist-tip">
            <span>${assistTipState.activeTip.text}</span>
            <button data-sk-tip-action="accept">Yes</button>
            <button data-sk-tip-action="dismiss" aria-label="Dismiss">&times;</button>
          </div>
        ` : ""}
        ${collapsed ? "" : `
          <div class="sk-notch-top">
            <div>
              <div class="sk-notch-title">Sidekick</div>
              <div class="sk-notch-status">${stateLabel}</div>
            </div>
            <button class="sk-notch-close" data-sk-action="collapse" aria-label="Collapse Sidekick">×</button>
          </div>
          <div class="sk-notch-panel">
            <div class="sk-notch-transcript">${transcript || "Talk or type naturally."}</div>
            <div class="sk-notch-response">${responseText || "Ready."}</div>
            <div class="sk-notch-input-row sk-notch-input-row-text">
              <input class="sk-notch-input" data-sk-input="command" placeholder="${agentState.askUserQuestion ? "Answer Sidekick..." : "Ask Sidekick..."}" />
              <button class="sk-notch-btn sk-notch-btn-primary" data-sk-action="send" aria-label="Send command">→</button>
            </div>
            <div class="sk-notch-footer">
              <div class="sk-notch-mini">Prompt mode</div>
              <div class="sk-notch-mini">${/Windows/i.test(navigator.userAgent) ? "Windows + H for dictation" : "Typing only"}</div>
            </div>
            <div class="sk-notch-quick">
              ${QUICK_ACTIONS.map((item) => `<button class="sk-notch-chip" data-sk-quick="${item.command}">${item.label}</button>`).join("")}
            </div>
            <div class="sk-notch-footer">
              <div class="sk-notch-mini">${agentState.command ? `Current: ${agentState.command}` : "Pinned to this page."}</div>
              <button class="sk-notch-btn sk-notch-btn-secondary" data-sk-action="stop">${agentState.isRunning ? "Stop" : "Close"}</button>
            </div>
          </div>
        `}
        <button class="sk-notch-pill sk-${stateLabel.toLowerCase()}" data-sk-action="${collapsed ? "expand" : "drag-handle"}" aria-label="Open Sidekick">
          <span class="sk-notch-state-ring"></span>
          ${createStateIcon()}
        </button>
      </div>
    `;

    setRootPosition();

    const pill = rootEl.querySelector(".sk-notch-pill");
    const input = rootEl.querySelector("[data-sk-input='command']");
    const sendButton = rootEl.querySelector("[data-sk-action='send']");
    const stopButton = rootEl.querySelector("[data-sk-action='stop']");
    const collapseButton = rootEl.querySelector("[data-sk-action='collapse']");
    const tipAccept = rootEl.querySelector("[data-sk-tip-action='accept']");
    const tipDismiss = rootEl.querySelector("[data-sk-tip-action='dismiss']");

    if (tipAccept) {
      tipAccept.addEventListener("click", (event) => {
        event.stopPropagation();
        submitCommand(assistTipState.activeTip?.command || "Help me");
      });
    }
    if (tipDismiss) {
      tipDismiss.addEventListener("click", (event) => {
        event.stopPropagation();
        dismissAssistTip(assistTipState.activeTip?.kind || "form");
      });
    }

    if (collapsed) {
      pill.addEventListener("click", () => toggleExpanded(false));
    } else {
      pill.addEventListener("pointerdown", startDrag);
      if (input) {
        input.value = transcript && !agentState.askUserQuestion ? transcript : "";
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitCommand(input.value);
          }
        });
      }
      if (sendButton) sendButton.addEventListener("click", () => submitCommand(input ? input.value : ""));
      if (stopButton) stopButton.addEventListener("click", () => {
        if (agentState.isRunning) chrome.runtime.sendMessage({ action: "STOP_AGENT" });
        else toggleExpanded(true);
      });
      if (collapseButton) collapseButton.addEventListener("click", () => toggleExpanded(true));
      rootEl.querySelectorAll("[data-sk-quick]").forEach((button) => {
        button.addEventListener("click", () => submitCommand(button.getAttribute("data-sk-quick") || ""));
      });
    }
  }

  function submitCommand(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value) return;
    stopSpeaking();
    currentTranscript = value;
    voiceState.transcript = value;
    voiceState.mode = "processing";
    renderNotch();

    if (agentState.suggestedFollowup) {
      chrome.runtime.sendMessage({
        action: "FOLLOWUP_RESPONSE",
        response: value,
        followupKey: agentState.suggestedFollowup.key,
        suggestedCommand: agentState.suggestedFollowup.suggestedCommand
      });
      return;
    }

    if (agentState.askUserQuestion) {
      chrome.runtime.sendMessage({ action: "USER_RESPONSE", response: value });
      return;
    }

    chrome.runtime.sendMessage({ action: "START_AGENT", command: value, source: "notch" });
  }

  function startDrag(event) {
    if (uiState.notchCollapsed) return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: getViewportPosition(uiState.notchPosition)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.addEventListener("pointermove", onDragMove);
    event.currentTarget.addEventListener("pointerup", stopDrag);
    event.currentTarget.addEventListener("pointercancel", stopDrag);
  }

  function onDragMove(event) {
    if (!dragState) return;
    const nextPosition = {
      x: dragState.origin.x + (event.clientX - dragState.startX),
      y: dragState.origin.y + (event.clientY - dragState.startY)
    };
    savePosition(nextPosition);
    setRootPosition();
  }

  function stopDrag(event) {
    if (!dragState) return;
    event.currentTarget.releasePointerCapture?.(dragState.pointerId);
    event.currentTarget.removeEventListener("pointermove", onDragMove);
    event.currentTarget.removeEventListener("pointerup", stopDrag);
    event.currentTarget.removeEventListener("pointercancel", stopDrag);
    dragState = null;
  }

  async function showSidekick(nextUiState) {
    uiState = { ...uiState, ...nextUiState, sidekickEnabled: true };
    renderNotch();
    setTimeout(refreshAssistTip, 700);
  }

  async function initializeNotch() {
    uiState = await readUiState();
    await loadAssistTipState();
    chrome.runtime.sendMessage({ action: "GET_STATE" }, (state) => {
      if (state) {
        agentState = state;
        renderNotch();
      }
    });
    chrome.runtime.sendMessage({ action: "GET_VOICE_STATE" }, (state) => {
      if (state) {
        voiceState = { ...voiceState, ...state };
        renderNotch();
      }
    });
    if (uiState.sidekickEnabled) {
      await showSidekick(uiState);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes.sidekickEnabled) uiState.sidekickEnabled = changes.sidekickEnabled.newValue;
    if (changes.notchPosition) uiState.notchPosition = changes.notchPosition.newValue;
    if (changes.notchCollapsed) uiState.notchCollapsed = changes.notchCollapsed.newValue;
    if (changes.voiceEnabled) uiState.voiceEnabled = changes.voiceEnabled.newValue;
    if (changes.voiceMode) uiState.voiceMode = changes.voiceMode.newValue;
    if (changes.wakeWord) uiState.wakeWord = changes.wakeWord.newValue;
    if (changes.autoSpeak) uiState.autoSpeak = changes.autoSpeak.newValue;
    if (changes.speechRate) uiState.speechRate = changes.speechRate.newValue;
    if (changes.sidekickTheme) uiState.sidekickTheme = changes.sidekickTheme.newValue;
    stopListening(true);
    if (uiState.sidekickEnabled) renderNotch();
    else destroyNotch();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === "SHOW_SIDEKICK") {
      showSidekick(message.ui || {}).then(() => sendResponse({ success: true }));
      return true;
    }

    if (message?.action === "HIDE_SIDEKICK" || message?.action === "REMOVE_NOTCH") {
      uiState.sidekickEnabled = false;
      destroyNotch();
      sendResponse({ success: true });
      return true;
    }

    if (message?.action === "SIDEKICK_ENABLED") {
      uiState.sidekickEnabled = Boolean(message.enabled);
      if (!uiState.sidekickEnabled) destroyNotch();
      sendResponse({ success: true });
      return true;
    }

    if (message?.action === "STATE_UPDATED") {
      agentState = message.state || agentState;
      if (uiState.sidekickEnabled) {
        renderNotch();
        setTimeout(refreshAssistTip, 500);
      }
      sendResponse({ success: true });
      return true;
    }

    if (message?.action === "VOICE_STATE_UPDATED") {
      const previousResponse = voiceState.lastResponse;
      voiceState = { ...voiceState, ...(message.voiceState || {}) };
      if (uiState.sidekickEnabled) renderNotch();
      sendResponse({ success: true });
      return true;
    }

    const { type, args } = message || {};
    try {
      switch (type) {
        case "DETECT_FORM":
          sendResponse({ success: true, data: detectFormSummary() });
          break;
        case "GET_FORM_FIELDS":
          sendResponse({ success: true, data: getFormFields() });
          break;
        case "FILL_FIELD": {
          const el = getFieldById(args.fieldId);
          if (!el) {
            sendResponse({ success: false, error: `Field not found: ${args.fieldId}` });
            break;
          }
          setFieldValue(el, args.value || "");
          sendResponse({ success: true, data: { fieldId: args.fieldId, value: isSensitiveField(el) ? "[filled sensitive value]" : args.value || "" } });
          break;
        }
        case "SELECT_OPTION": {
          const el = getFieldById(args.fieldId);
          if (!el || el.tagName.toLowerCase() !== "select") {
            sendResponse({ success: false, error: `Dropdown not found: ${args.fieldId}` });
            break;
          }
          const wanted = String(args.value || "").toLowerCase();
          const option = Array.from(el.options).find((opt) => opt.value.toLowerCase() === wanted || opt.text.toLowerCase().includes(wanted));
          if (!option) {
            sendResponse({ success: false, error: `Option not found: ${args.value}` });
            break;
          }
          el.value = option.value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: { fieldId: args.fieldId, selected: option.text } });
          break;
        }
        case "CHECK_BOX":
        case "UNCHECK_BOX": {
          const el = getFieldById(args.fieldId);
          if (!el) {
            sendResponse({ success: false, error: `Checkbox not found: ${args.fieldId}` });
            break;
          }
          el.checked = type === "CHECK_BOX";
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: { fieldId: args.fieldId, checked: el.checked } });
          break;
        }
        case "CHOOSE_RADIO": {
          const fields = getFormFields();
          const target = fields.find((field) => field.id === args.fieldId || field.label.toLowerCase().includes(String(args.fieldId || args.value || "").toLowerCase()));
          const radios = Array.from(document.querySelectorAll(`input[type="radio"]${target?.name ? `[name="${CSS.escape(target.name)}"]` : ""}`)).filter(isElementVisible);
          const wanted = String(args.value || "").toLowerCase();
          const radio = radios.find((item) => item.value.toLowerCase() === wanted || getFieldLabel(item).toLowerCase().includes(wanted));
          if (!radio) {
            sendResponse({ success: false, error: `Radio option not found: ${args.value}` });
            break;
          }
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: { fieldId: getOrAssignSidekickId(radio), selected: getFieldLabel(radio) } });
          break;
        }
        case "CLEAR_FIELD": {
          const el = getFieldById(args.fieldId);
          if (!el) {
            sendResponse({ success: false, error: `Field not found: ${args.fieldId}` });
            break;
          }
          setFieldValue(el, "");
          sendResponse({ success: true, data: { fieldId: args.fieldId, cleared: true } });
          break;
        }
        case "REVIEW_FORM":
          sendResponse({ success: true, data: reviewFormValues() });
          break;
        case "SUBMIT_FORM": {
          const summary = detectFormSummary();
          const submit = summary.submitButtons[0];
          const el = submit ? getFieldById(submit.id) : Array.from(document.querySelectorAll("button, input[type='submit'], [role='button']")).find((button) => /submit|send|apply|save|continue|next|post|publish/i.test(button.innerText || button.value || ""));
          if (!el) {
            sendResponse({ success: false, error: "No submit button found" });
            break;
          }
          simulateClick(el);
          sendResponse({ success: true, data: "Submitted form" });
          break;
        }
        case "GET_PAGE_CONTEXT":
          sendResponse({ success: true, data: getPageContext() });
          break;
        case "GET_DOM_PERCEPTION":
          sendResponse({ success: true, data: getDomPerception() });
          break;
        case "GET_READABLE_PAGE":
        case "EXTRACT_READABLE_PAGE":
          sendResponse({ success: true, data: getReadablePage() });
          break;
        case "PARSE_LOCAL_COMMAND":
          sendResponse({ success: true, data: window.SidekickLibs?.parseCommand?.(args.command || "") || { intent: "general", topics: [], dates: [] } });
          break;
        case "GET_PAGE_TEXT":
          sendResponse({ success: true, data: document.body.innerText.substring(0, 8000) });
          break;
        case "YOUTUBE_SEEK_TO_TIMESTAMP": {
          const video = document.querySelector("video");
          if (!video) {
            sendResponse({ success: false, error: "No video player detected on page" });
            break;
          }
          const seconds = parseTimestampToSeconds(args.timestamp);
          if (seconds !== null) {
            video.currentTime = seconds;
            video.play();
            sendResponse({ success: true, data: `Seeked to ${seconds} seconds` });
          } else if (seekToChapter(args.timestamp)) {
            sendResponse({ success: true, data: `Navigated to chapter: "${args.timestamp}"` });
          } else {
            sendResponse({ success: false, error: `Could not parse time or find chapter for: "${args.timestamp}"` });
          }
          break;
        }
        case "YOUTUBE_GET_CURRENT_TIMESTAMP": {
          const video = document.querySelector("video");
          if (!video) {
            sendResponse({ success: false, error: "No active video found" });
            break;
          }
          const time = Math.floor(video.currentTime);
          const hrs = Math.floor(time / 3600);
          const mins = Math.floor((time % 3600) / 60);
          const secs = time % 60;
          const formatted = hrs > 0 ? `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${mins}:${String(secs).padStart(2, "0")}`;
          sendResponse({ success: true, data: formatted });
          break;
        }
        case "YOUTUBE_GET_VIDEO_TITLE": {
          const titleEl = document.querySelector("h1.ytd-watch-metadata, ytd-video-primary-info-renderer h1");
          sendResponse({ success: true, data: titleEl ? titleEl.innerText.trim() : document.title });
          break;
        }
        case "YOUTUBE_CHECK_LOGIN": {
          const signInBtn = document.querySelector('a[href*="ServiceLogin"], ytd-button-renderer[class*="sign-in"]');
          sendResponse({ success: true, data: !signInBtn });
          break;
        }
        case "EXTRACT_PRODUCT_CARDS":
          sendResponse({ success: true, data: extractProductCards() });
          break;
        case "EXTRACT_PRICES":
          sendResponse({
            success: true,
            data: extractProductCards().map((item) => ({
              title: item.title,
              price: item.price,
              priceValue: item.priceValue,
              currency: item.priceCurrency || window.SidekickLibs?.normalizePrice?.(item.price)?.currency || ""
            }))
          });
          break;
        case "SORT_ITEMS_BY_PRICE":
          sendResponse({ success: true, data: extractProductCards().sort((a, b) => parsePriceToNumber(a.price) - parsePriceToNumber(b.price)) });
          break;
        case "EXTRACT_REVIEWS":
          sendResponse({ success: true, data: extractProductCards().map((item) => ({ title: item.title, reviews: item.reviews })) });
          break;
        case "EXTRACT_RATINGS":
          sendResponse({ success: true, data: extractProductCards().map((item) => ({ title: item.title, rating: item.rating })) });
          break;
        case "CLICK_TEXT": {
          const el = findBestMatch(Array.from(document.querySelectorAll("a, button, [role='button'], input, p, span, div, h1, h2, h3, h4")), args.target);
          if (el) {
            simulateClick(el);
            sendResponse({ success: true, data: `Clicked: ${args.target}` });
          } else sendResponse({ success: false, error: `Could not click target: "${args.target}"` });
          break;
        }
        case "CLICK_ELEMENT": {
          const el = getFieldById(args.id);
          if (el) {
            simulateClick(el);
            sendResponse({ success: true, data: `Clicked element: ${args.id}` });
          } else sendResponse({ success: false, error: `Element not found: "${args.id}"` });
          break;
        }
        case "TYPE_TEXT": {
          const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']"));
          let el = null;
          if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && isElementVisible(document.activeElement)) {
            el = document.activeElement;
          } else if (args.target) {
            el = findBestMatch(inputs, args.target);
          }
          if (!el && inputs.length > 0) el = inputs.find(isElementVisible);
          if (el) {
            el.focus();
            el.value = "";
            el.value = args.text;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            sendResponse({ success: true, data: `Typed text in: ${getOrAssignSidekickId(el)}` });
          } else sendResponse({ success: false, error: "No text input found" });
          break;
        }
        case "TYPE_INTO_ELEMENT": {
          const el = getFieldById(args.id);
          if (!el) {
            sendResponse({ success: false, error: `Element not found: "${args.id}"` });
            break;
          }
          setFieldValue(el, args.text || "");
          sendResponse({ success: true, data: `Typed text in element: ${args.id}` });
          break;
        }
        case "SCROLL_DOWN":
          window.scrollBy({ top: window.innerHeight * 0.75, behavior: "smooth" });
          sendResponse({ success: true, data: "Scrolled" });
          break;
        case "SCROLL_UP":
          window.scrollBy({ top: -window.innerHeight * 0.75, behavior: "smooth" });
          sendResponse({ success: true, data: "Scrolled" });
          break;
        case "SCROLL_TO_TOP":
          window.scrollTo({ top: 0, behavior: "smooth" });
          sendResponse({ success: true, data: "Scrolled to top" });
          break;
        case "SCROLL_TO_BOTTOM":
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
          sendResponse({ success: true, data: "Scrolled to bottom" });
          break;
        case "PRESS_ENTER": {
          const el = document.activeElement || document.body;
          el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
          sendResponse({ success: true });
          break;
        }
        case "COPY_SELECTED_TEXT":
          sendResponse({ success: true, data: window.getSelection().toString() });
          break;
        case "WRITE_TEXT": {
          const inputs = Array.from(document.querySelectorAll("textarea, input:not([type='hidden']), [contenteditable='true']"));
          const el = args.target ? findBestMatch(inputs, args.target) : (document.activeElement && inputs.includes(document.activeElement) ? document.activeElement : inputs.find(isElementVisible));
          if (!el) {
            sendResponse({ success: false, error: "No writable target found" });
            break;
          }
          setFieldValue(el, args.text || "");
          sendResponse({ success: true, data: `Wrote text in ${getOrAssignSidekickId(el)}` });
          break;
        }
        case "REPLACE_SELECTED_TEXT": {
          const selected = window.getSelection().toString();
          chrome.storage.local.set({ sidekickUndoText: selected });
          if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
            const el = document.activeElement;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? start;
            el.setRangeText(args.text || "", start, end, "end");
            el.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            document.execCommand("insertText", false, args.text || "");
          }
          sendResponse({ success: true, data: { replaced: true, undoStored: true } });
          break;
        }
        case "CLICK_LINK": {
          if (!args.target && !args.id && !args.url) {
            sendResponse({ success: false, error: "Missing link target. Ask LLM to choose a visible link or search result." });
            break;
          }
          let el = null;
          if (args.target && /first result/i.test(args.target)) {
            const firstResult = extractSearchResults()[0];
            if (firstResult?.id) {
              el = document.querySelector(`[data-sidekick-id="${firstResult.id}"]`);
            }
          }
          if (args.id) el = document.querySelector(`[data-sidekick-id="${args.id}"]`);
          if (!el && args.url) el = Array.from(document.querySelectorAll("a")).find((anchor) => anchor.href === args.url);
          if (!el) el = findBestMatch(Array.from(document.querySelectorAll("a")), args.target || args.url || args.id);
          if (el) {
            simulateClick(el);
            sendResponse({ success: true, data: `Clicked link: ${args.target || args.id || args.url}` });
          } else sendResponse({ success: false, error: `Could not find link: "${args.target || args.id || args.url}"` });
          break;
        }
        case "CLICK_BUTTON": {
          const el = findBestMatch(Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']")), args.target);
          if (el) {
            simulateClick(el);
            sendResponse({ success: true, data: `Clicked button: ${args.target}` });
          } else sendResponse({ success: false, error: `Could not find button: "${args.target}"` });
          break;
        }
        case "CLICK_INPUT": {
          const el = findBestMatch(Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']")), args.target);
          if (el) {
            simulateClick(el);
            sendResponse({ success: true, data: `Clicked input: ${args.target}` });
          } else sendResponse({ success: false, error: `Could not find input: "${args.target}"` });
          break;
        }
        case "HOVER_TEXT": {
          const el = findBestMatch(Array.from(document.querySelectorAll("a, button, [role='button'], input, p, span, div, h1, h2, h3, h4")), args.target);
          if (el) {
            el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window }));
            sendResponse({ success: true, data: `Hovered: ${args.target}` });
          } else sendResponse({ success: false, error: `Could not hover target: "${args.target}"` });
          break;
        }
        case "DOUBLE_CLICK_TEXT": {
          const el = findBestMatch(Array.from(document.querySelectorAll("a, button, [role='button'], input, p, span, div, h1, h2, h3, h4")), args.target);
          if (el) {
            el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
            sendResponse({ success: true, data: `Double clicked: ${args.target}` });
          } else sendResponse({ success: false, error: `Could not double click target: "${args.target}"` });
          break;
        }
        case "FIND_TEXT": {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          let node;
          const matches = [];
          while ((node = walker.nextNode())) {
            if (node.textContent.toLowerCase().includes(args.query.toLowerCase())) {
              matches.push(node.textContent.trim().substring(0, 100));
              if (matches.length >= 5) break;
            }
          }
          sendResponse({ success: true, data: matches.length > 0 ? matches : "Text not found" });
          break;
        }
        case "SCROLL_TO_TEXT": {
          const el = findBestMatch(Array.from(document.querySelectorAll("a, button, p, span, div, h1, h2, h3, h4, label")), args.text);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            sendResponse({ success: true, data: `Scrolled to: ${args.text}` });
          } else sendResponse({ success: false, error: `Text not found: ${args.text}` });
          break;
        }
        case "HIGHLIGHT_TEXT": {
          const el = findBestMatch(Array.from(document.querySelectorAll("a, button, p, span, div, h1, h2, h3, h4, label")), args.text);
          if (el) {
            el.style.outline = "3px solid #facc15";
            el.style.outlineOffset = "3px";
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            sendResponse({ success: true, data: `Highlighted: ${args.text}` });
          } else sendResponse({ success: false, error: `Text not found: ${args.text}` });
          break;
        }
        case "GET_LINKS":
          sendResponse({
            success: true,
            data: Array.from(document.querySelectorAll("a"))
              .filter(isElementVisible)
              .slice(0, 80)
              .map((el) => ({
                id: getOrAssignSidekickId(el),
                text: el.innerText.trim().substring(0, 80),
                href: el.href,
                domain: el.href ? new URL(el.href).hostname.replace(/^www\./, "") : "",
                visible: true,
                ariaLabel: el.getAttribute("aria-label") || "",
                title: el.getAttribute("title") || ""
              }))
          });
          break;
        case "EXTRACT_LINKS":
          sendResponse({
            success: true,
            data: Array.from(document.querySelectorAll("a[href]"))
              .filter(isElementVisible)
              .slice(0, 120)
              .map((el) => ({ text: el.innerText.trim().substring(0, 100), href: el.href }))
          });
          break;
        case "EXTRACT_TABLE": {
          const tables = Array.from(document.querySelectorAll("table")).filter(isElementVisible).slice(0, 5).map((table) => Array.from(table.querySelectorAll("tr")).slice(0, 80).map((row) => Array.from(row.querySelectorAll("th,td")).map((cell) => cell.innerText.trim())));
          sendResponse({ success: true, data: tables });
          break;
        }
        case "GET_SEARCH_RESULTS":
          sendResponse({ success: true, data: extractSearchResults() });
          break;
        case "GET_BUTTONS":
          sendResponse({ success: true, data: Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']")).filter(isElementVisible).slice(0, 30).map((el) => ({ id: getOrAssignSidekickId(el), text: el.innerText.trim().substring(0, 50) })) });
          break;
        case "EXTRACT_BUTTONS":
          sendResponse({
            success: true,
            data: Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"))
              .filter(isElementVisible)
              .slice(0, 80)
              .map((el) => ({
                id: getOrAssignSidekickId(el),
                text: (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().substring(0, 100),
                ariaLabel: el.getAttribute("aria-label") || "",
                disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true")
              }))
          });
          break;
        case "GET_INPUTS":
          sendResponse({ success: true, data: Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']")).filter(isElementVisible).slice(0, 20).map((el) => ({ id: getOrAssignSidekickId(el), text: (el.innerText || el.value || el.placeholder || "").trim().substring(0, 50), type: el.type || el.tagName.toLowerCase() })) });
          break;
        case "EXTRACT_INPUTS":
          sendResponse({ success: true, data: getFormFields() });
          break;
        case "GET_HEADINGS":
          sendResponse({ success: true, data: Array.from(document.querySelectorAll("h1, h2, h3, h4")).filter(isElementVisible).slice(0, 15).map((el) => ({ tag: el.tagName.toLowerCase(), text: el.innerText.trim().substring(0, 60) })) });
          break;
        case "EXTRACT_HEADINGS":
          sendResponse({ success: true, data: Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(isElementVisible).slice(0, 60).map((el) => ({ level: el.tagName.toLowerCase(), text: el.innerText.trim() })) });
          break;
        case "GET_IMAGES":
          sendResponse({ success: true, data: Array.from(document.querySelectorAll("img")).filter(isElementVisible).slice(0, 15).map((el) => ({ id: getOrAssignSidekickId(el), src: el.src, alt: el.alt || "" })) });
          break;
        case "CLEAR_INPUT": {
          const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']"));
          let el = args.target ? findBestMatch(inputs, args.target) : null;
          if (!el && inputs.length > 0) el = inputs.find(isElementVisible);
          if (el) {
            el.value = "";
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            sendResponse({ success: true, data: "Input cleared" });
          } else sendResponse({ success: false, error: "No input found to clear" });
          break;
        }
        case "PASTE_TEXT": {
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.hasAttribute("contenteditable"))) {
            activeEl.value = (activeEl.value || "") + args.text;
            activeEl.dispatchEvent(new Event("input", { bubbles: true }));
            sendResponse({ success: true, data: "Text pasted" });
          } else sendResponse({ success: false, error: "No active text input found" });
          break;
        }
        case "SELECT_DROPDOWN": {
          const selects = Array.from(document.querySelectorAll("select"));
          let el = args.target ? findBestMatch(selects, args.target) : null;
          if (!el && selects.length > 0) el = selects.find(isElementVisible);
          if (el) {
            const option = Array.from(el.options).find((opt) => opt.value === args.value || opt.text.toLowerCase().includes(args.value.toLowerCase()));
            if (option) {
              el.value = option.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              sendResponse({ success: true, data: `Selected: ${option.text}` });
            } else sendResponse({ success: false, error: `Option "${args.value}" not found` });
          } else sendResponse({ success: false, error: "No dropdown found" });
          break;
        }
        case "CHECK_CHECKBOX":
        case "UNCHECK_CHECKBOX": {
          const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']"));
          let el = args.target ? findBestMatch(checkboxes, args.target) : null;
          if (!el && checkboxes.length > 0) el = checkboxes.find(isElementVisible);
          if (el) {
            el.checked = type === "CHECK_CHECKBOX";
            el.dispatchEvent(new Event("change", { bubbles: true }));
            sendResponse({ success: true, data: type === "CHECK_CHECKBOX" ? "Checkbox checked" : "Checkbox unchecked" });
          } else sendResponse({ success: false, error: "No checkbox found" });
          break;
        }
        case "PRESS_KEY": {
          const key = args.key || "Enter";
          const activeEl = document.activeElement || document.body;
          activeEl.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, keyCode: key.charCodeAt(0), bubbles: true }));
          sendResponse({ success: true, data: `Pressed key: ${key}` });
          break;
        }
        case "EXTRACT_EMAILS": {
          const emails = document.body.innerText.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
          sendResponse({ success: true, data: [...new Set(emails)].slice(0, 10) });
          break;
        }
        case "EXTRACT_PHONE_NUMBERS": {
          const phones = document.body.innerText.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,6}[-\s\.]?[0-9]{3,6}/g) || [];
          sendResponse({ success: true, data: [...new Set(phones)].slice(0, 10) });
          break;
        }
        case "EXTRACT_DATES": {
          const dates = document.body.innerText.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi) || [];
          sendResponse({ success: true, data: [...new Set(dates)].slice(0, 10) });
          break;
        }
        case "EXTRACT_JOBS": {
          const lines = document.body.innerText.split("\n").map((line) => line.trim()).filter(Boolean);
          sendResponse({ success: true, data: lines.filter((line) => /(engineer|developer|designer|manager|analyst|intern|full.?time|remote|salary|apply)/i.test(line)).slice(0, 80) });
          break;
        }
        case "EXTRACT_COURSES": {
          const lines = document.body.innerText.split("\n").map((line) => line.trim()).filter(Boolean);
          sendResponse({ success: true, data: lines.filter((line) => /(course|lesson|module|certificate|instructor|rating|enroll|curriculum)/i.test(line)).slice(0, 80) });
          break;
        }
        case "EXTRACT_EVENTS": {
          const lines = document.body.innerText.split("\n").map((line) => line.trim()).filter(Boolean);
          sendResponse({ success: true, data: lines.filter((line) => /(event|webinar|conference|meetup|workshop|ticket|register|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\d{1,2}[\/-]\d{1,2})/i.test(line)).slice(0, 80) });
          break;
        }
        case "EXTRACT_CONTACT_INFO": {
          const text = document.body.innerText;
          const emails = [...new Set(text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [])].slice(0, 20);
          const phones = [...new Set(text.match(/[\+]?[(]?[0-9]{1,3}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{3,6}[-\s.]?[0-9]{3,6}/g) || [])].slice(0, 20);
          const detected = window.SidekickLibs?.extractLinkified?.(text).filter((item) => item.type === "email" || item.type === "url").slice(0, 40) || [];
          const links = Array.from(document.querySelectorAll("a[href]")).filter(isElementVisible).filter((el) => /contact|mailto:|linkedin|twitter|x\.com|instagram/i.test(el.href + " " + el.innerText)).slice(0, 30).map((el) => ({ text: el.innerText.trim(), href: el.href }));
          sendResponse({ success: true, data: { emails, phones, links, detected } });
          break;
        }
        case "OCR_IMAGE_TEXT": {
          const targetImage = args.src
            ? Array.from(document.querySelectorAll("img")).find((img) => img.src === args.src || img.src.includes(args.src))
            : Array.from(document.querySelectorAll("img")).filter(isElementVisible)[0];
          if (!targetImage?.src) {
            sendResponse({ success: false, error: "No visible image found for OCR" });
            break;
          }
          window.SidekickLibs?.ocrImage?.(targetImage.src).then(sendResponse);
          return true;
        }
        case "SELECT_ALL":
          document.execCommand("selectAll");
          sendResponse({ success: true, data: "Selected all" });
          break;
        case "OPEN_PRODUCT_BY_ID": {
          if (!args.id) {
            sendResponse({ success: false, error: "Missing link target. Ask LLM to choose a visible link or search result." });
            break;
          }
          const el = document.querySelector(`[data-sidekick-id="${args.id}"]`);
          if (!el) {
            sendResponse({ success: false, error: `Could not find product: "${args.id}"` });
            break;
          }
          simulateClick(el);
          sendResponse({ success: true, data: `Opened product: ${args.id}` });
          break;
        }
        default:
          sendResponse({ success: false, error: `DOM Action type not supported: ${type}` });
      }
    } catch (err) {
      sendResponse({ success: false, error: `Content error: ${err.message}` });
    }

    return true;
  });

  window.addEventListener("resize", () => {
    if (uiState.sidekickEnabled) setRootPosition();
  });

  initializeNotch().catch((err) => {
    console.warn("Sidekick notch init failed", err);
  });
}
