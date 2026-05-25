// Sidekick — Upgraded Content Script (Advanced Skills & Extractors)

console.log("Sidekick Advanced Content Script Loaded");

// Helper to determine if an element is visible
function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

// Sidekick unique element IDs (transient)
var skIdCounter = 1; // Use var to avoid duplicate declaration
function getOrAssignSidekickId(el) {
  let id = el.getAttribute("data-sidekick-id");
  if (!id) {
    id = `sk-${skIdCounter++}`;
    el.setAttribute("data-sidekick-id", id);
  }
  return id;
}

// Strong fuzzy match implementation
function findBestMatch(elements, targetText) {
  if (!targetText) return null;
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

    // 1. Exact matches
    if (elText === target) score = 100;
    else if (ariaLabel === target) score = 95;
    else if (placeholder === target) score = 90;
    else if (title === target) score = 85;
    else if (id === target) score = 80;
    else if (skId === target) score = 75;
    // 2. Includes matches
    else if (elText.includes(target)) score = 70;
    else if (ariaLabel.includes(target)) score = 65;
    else if (placeholder.includes(target)) score = 60;
    else if (title.includes(target)) score = 55;
    // 3. Word matches
    else {
      const elWords = elText.split(/\s+/);
      const targetWords = target.split(/\s+/);
      let overlaps = 0;
      for (const w of targetWords) {
        if (w && elWords.includes(w)) overlaps++;
      }
      if (overlaps > 0) {
        score = 10 + (overlaps / elWords.length) * 20;
      }
    }

    if (score > bestScore && score > 0) {
      bestScore = score;
      bestElement = el;
    }
  }

  return bestElement;
}

// Token Optimized Element Indexing Context (max limits applied)
function getPageContext() {
  const getCompactAttributes = (el, type) => {
    return {
      id: getOrAssignSidekickId(el),
      type: type,
      text: (el.innerText || el.value || el.placeholder || "").trim().substring(0, 50)
    };
  };

  // Tiny text context limit of 2000 chars by default
  const visibleText = document.body.innerText.substring(0, 2000);

  const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"))
    .filter(isElementVisible)
    .slice(0, 30)
    .map(el => getCompactAttributes(el, "button"));

  const links = Array.from(document.querySelectorAll("a"))
    .filter(isElementVisible)
    .slice(0, 30)
    .map(el => getCompactAttributes(el, "link"));

  const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']"))
    .filter(isElementVisible)
    .slice(0, 20)
    .map(el => getCompactAttributes(el, "input"));

  const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"))
    .filter(isElementVisible)
    .slice(0, 15)
    .map(el => ({ tag: el.tagName.toLowerCase(), text: el.innerText.trim().substring(0, 60) }));

  return {
    url: window.location.href,
    title: document.title,
    visibleText,
    buttons,
    links,
    inputs,
    headings
  };
}

// Perfect simulated clicks
function simulateClick(el) {
  el.focus();
  const mouseClickEvents = ['mousedown', 'click', 'mouseup'];
  mouseClickEvents.forEach(trigger => {
    const event = new MouseEvent(trigger, {
      bubbles: true,
      cancelable: true,
      view: window
    });
    el.dispatchEvent(event);
  });
}

// Advanced timestamp conversion helper
function parseTimestampToSeconds(str) {
  if (!str) return null;
  const clean = str.toLowerCase().trim();
  
  // 1. Format: hh:mm:ss or mm:ss
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

  // 2. Format: "10 minutes", "90 seconds", "10 min 20 sec"
  let totalSeconds = 0;
  const hrMatch = clean.match(/(\d+)\s*(?:hour|hr|h)/);
  const minMatch = clean.match(/(\d+)\s*(?:minute|min|m)/);
  const secMatch = clean.match(/(\d+)\s*(?:second|sec|s)/);

  if (hrMatch) totalSeconds += parseInt(hrMatch[1], 10) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1], 10);

  if (totalSeconds > 0) return totalSeconds;

  // 3. Raw digit match
  const rawDigits = clean.match(/^\d+$/);
  if (rawDigits) return parseInt(clean, 10);

  return null;
}

// Seek directly to chapter name matches on YouTube page
function seekToChapter(chapterName) {
  const lower = chapterName.toLowerCase().trim();
  // Query markers list in description or sidebar chapters list
  const chapters = Array.from(document.querySelectorAll(".ytp-chapter-title, ytd-macro-markers-list-item-renderer, a[href*='t=']"));
  const match = chapters.find(el => el.innerText.toLowerCase().includes(lower));
  if (match) {
    match.click();
    return true;
  }
  return false;
}

// Robust generic e-commerce element parser
function extractProductCards() {
  const products = [];
  
  // Target lists on Amazon, eBay, Walmart, or generic cards
  let cards = Array.from(document.querySelectorAll('[data-component-type="s-search-result"], .s-result-item, .s-item, [class*="product-card" i], [class*="product-item" i]'));
  
  if (cards.length === 0) {
    cards = Array.from(document.querySelectorAll('.s-item, .product-layout, .grid-item, [class*="card" i]'));
  }
  
  for (const card of cards) {
    if (!isElementVisible(card)) continue;
    
    // Extract Product Title
    const titleEl = card.querySelector('h2, h3, [class*="title" i], .s-line-clamp-2, a.a-link-normal span');
    if (!titleEl) continue;
    const title = titleEl.innerText.trim();
    if (!title || title.length < 5) continue;
    
    // Extract Price
    let price = "";
    const priceEl = card.querySelector('.a-price-whole, .a-price, .price, [class*="price" i], .s-item__price');
    if (priceEl) {
      price = priceEl.innerText.trim().replace(/\n/g, ".");
    } else {
      const priceMatch = card.innerText.match(/\$\d+(?:\.\d{2})?/);
      if (priceMatch) price = priceMatch[0];
    }
    if (!price) continue; // Skip cards without prices
    
    // Extract Rating
    let rating = "";
    const ratingEl = card.querySelector('.a-icon-alt, [class*="rating" i], .s-item__stars');
    if (ratingEl) {
      rating = ratingEl.innerText.trim();
    } else {
      const ratingMatch = card.innerHTML.match(/(\d+(?:\.\d+)?)\s*(?:out of )?5\s*stars/i);
      if (ratingMatch) rating = `${ratingMatch[1]}/5`;
    }
    
    // Extract Reviews
    let reviews = "";
    const reviewsEl = card.querySelector('.a-size-base, [class*="reviews" i], [class*="review-count" i]');
    if (reviewsEl) {
      reviews = reviewsEl.innerText.trim();
    }
    
    // Link & Image
    const linkEl = card.querySelector('a[href*="/dp/"], a[href*="/itm/"], a[class*="link" i], h2 a, a');
    const href = linkEl ? linkEl.href : "";
    const imgEl = card.querySelector('img.s-image, img.product-image, img');
    const imageSrc = imgEl ? imgEl.src : "";

    products.push({
      title,
      price,
      rating,
      reviews,
      href,
      imageSrc
    });
  }

  return products.slice(0, 15); // Cap at 15 items for token efficiency
}

// Convert price strings to sortable floats
function parsePriceToNumber(priceStr) {
  if (!priceStr) return Infinity;
  const clean = priceStr.replace(/[^\d.]/g, "");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? Infinity : parsed;
}

// Listen for action triggers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, args } = message;

  try {
    switch (type) {
      case "GET_PAGE_CONTEXT": {
        sendResponse({ success: true, data: getPageContext() });
        break;
      }

      case "GET_PAGE_TEXT": {
        // Cap to 8000 characters for full details requested specifically
        sendResponse({ success: true, data: document.body.innerText.substring(0, 8000) });
        break;
      }

      // -----------------------------------------------------------------------
      // YouTube advanced tools
      // -----------------------------------------------------------------------
      case "YOUTUBE_SEEK_TO_TIMESTAMP": {
        const video = document.querySelector("video");
        if (video) {
          const seconds = parseTimestampToSeconds(args.timestamp);
          if (seconds !== null) {
            video.currentTime = seconds;
            video.play();
            sendResponse({ success: true, data: `Seeked to ${seconds} seconds` });
          } else {
            const chapterFound = seekToChapter(args.timestamp);
            if (chapterFound) {
              sendResponse({ success: true, data: `Navigated to chapter: "${args.timestamp}"` });
            } else {
              sendResponse({ success: false, error: `Could not parse time or find chapter for: "${args.timestamp}"` });
            }
          }
        } else {
          sendResponse({ success: false, error: "No video player detected on page" });
        }
        break;
      }

      case "YOUTUBE_GET_CURRENT_TIMESTAMP": {
        const video = document.querySelector("video");
        if (video) {
          const time = Math.floor(video.currentTime);
          const hrs = Math.floor(time / 3600);
          const mins = Math.floor((time % 3600) / 60);
          const secs = time % 60;
          const formatted = hrs > 0 
            ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${mins}:${secs.toString().padStart(2, '0')}`;
          sendResponse({ success: true, data: formatted });
        } else {
          sendResponse({ success: false, error: "No active video found" });
        }
        break;
      }

      case "YOUTUBE_GET_VIDEO_TITLE": {
        const titleEl = document.querySelector("h1.ytd-watch-metadata, ytd-video-primary-info-renderer h1");
        const title = titleEl ? titleEl.innerText.trim() : document.title;
        sendResponse({ success: true, data: title });
        break;
      }

      case "YOUTUBE_CHECK_LOGIN": {
        // Quick heuristics to see if visitor is guest
        const signInBtn = document.querySelector('a[href*="ServiceLogin"], ytd-button-renderer[class*="sign-in"]');
        const isLoggedIn = !signInBtn;
        sendResponse({ success: true, data: isLoggedIn });
        break;
      }

      // -----------------------------------------------------------------------
      // Commerce Advanced Extractor tools
      // -----------------------------------------------------------------------
      case "EXTRACT_PRODUCT_CARDS": {
        const list = extractProductCards();
        sendResponse({ success: true, data: list });
        break;
      }

      case "EXTRACT_PRICES": {
        const list = extractProductCards().map(item => ({ title: item.title, price: item.price }));
        sendResponse({ success: true, data: list });
        break;
      }

      case "SORT_ITEMS_BY_PRICE": {
        const sorted = extractProductCards().sort((a, b) => {
          return parsePriceToNumber(a.price) - parsePriceToNumber(b.price);
        });
        sendResponse({ success: true, data: sorted });
        break;
      }

      case "EXTRACT_REVIEWS": {
        const list = extractProductCards().map(item => ({ title: item.title, reviews: item.reviews }));
        sendResponse({ success: true, data: list });
        break;
      }

      case "EXTRACT_RATINGS": {
        const list = extractProductCards().map(item => ({ title: item.title, rating: item.rating }));
        sendResponse({ success: true, data: list });
        break;
      }

      // -----------------------------------------------------------------------
      // Legacy element selectors with tiny-caps matching support
      // -----------------------------------------------------------------------
      case "CLICK_TEXT": {
        const target = args.target;
        const allElements = Array.from(document.querySelectorAll("a, button, [role='button'], input, p, span, div, h1, h2, h3, h4"));
        const el = findBestMatch(allElements, target);
        if (el) {
          simulateClick(el);
          sendResponse({ success: true, data: `Clicked: ${target}` });
        } else {
          sendResponse({ success: false, error: `Could not click target: "${target}"` });
        }
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
        if (!el && inputs.length > 0) {
          el = inputs.find(isElementVisible);
        }
        if (el) {
          el.focus();
          el.value = "";
          el.value = args.text;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: `Typed text in: ${getOrAssignSidekickId(el)}` });
        } else {
          sendResponse({ success: false, error: "No text input found" });
        }
        break;
      }

      // Delegate legacy tools to base cases
      case "SCROLL_DOWN": {
        window.scrollBy({ top: window.innerHeight * 0.75, behavior: "smooth" });
        sendResponse({ success: true, data: "Scrolled" });
        break;
      }
      case "SCROLL_UP": {
        window.scrollBy({ top: -window.innerHeight * 0.75, behavior: "smooth" });
        sendResponse({ success: true, data: "Scrolled" });
        break;
      }
      case "SCROLL_TO_TOP": {
        window.scrollTo({ top: 0, behavior: "smooth" });
        sendResponse({ success: true, data: "Scrolled to top" });
        break;
      }
      case "SCROLL_TO_BOTTOM": {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        sendResponse({ success: true, data: "Scrolled to bottom" });
        break;
      }
      case "PRESS_ENTER": {
        const el = document.activeElement || document.body;
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        sendResponse({ success: true });
        break;
      }
      case "COPY_SELECTED_TEXT": {
        const text = window.getSelection().toString();
        sendResponse({ success: true, data: text });
        break;
      }

      // Link-specific click
      case "CLICK_LINK": {
        const target = args.target;
        const allLinks = Array.from(document.querySelectorAll("a"));
        const el = findBestMatch(allLinks, target);
        if (el) {
          simulateClick(el);
          sendResponse({ success: true, data: `Clicked link: ${target}` });
        } else {
          sendResponse({ success: false, error: `Could not find link: "${target}"` });
        }
        break;
      }

      // Button-specific click
      case "CLICK_BUTTON": {
        const target = args.target;
        const allButtons = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"));
        const el = findBestMatch(allButtons, target);
        if (el) {
          simulateClick(el);
          sendResponse({ success: true, data: `Clicked button: ${target}` });
        } else {
          sendResponse({ success: false, error: `Could not find button: "${target}"` });
        }
        break;
      }

      // Input-specific click
      case "CLICK_INPUT": {
        const target = args.target;
        const allInputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']"));
        const el = findBestMatch(allInputs, target);
        if (el) {
          simulateClick(el);
          sendResponse({ success: true, data: `Clicked input: ${target}` });
        } else {
          sendResponse({ success: false, error: `Could not find input: "${target}"` });
        }
        break;
      }

      // Hover action
      case "HOVER_TEXT": {
        const target = args.target;
        const allElements = Array.from(document.querySelectorAll("a, button, [role='button'], input, p, span, div, h1, h2, h3, h4"));
        const el = findBestMatch(allElements, target);
        if (el) {
          const hoverEvent = new MouseEvent('mouseenter', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          el.dispatchEvent(hoverEvent);
          sendResponse({ success: true, data: `Hovered: ${target}` });
        } else {
          sendResponse({ success: false, error: `Could not hover target: "${target}"` });
        }
        break;
      }

      // Double click action
      case "DOUBLE_CLICK_TEXT": {
        const target = args.target;
        const allElements = Array.from(document.querySelectorAll("a, button, [role='button'], input, p, span, div, h1, h2, h3, h4"));
        const el = findBestMatch(allElements, target);
        if (el) {
          const dblClickEvent = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          el.dispatchEvent(dblClickEvent);
          sendResponse({ success: true, data: `Double clicked: ${target}` });
        } else {
          sendResponse({ success: false, error: `Could not double click target: "${target}"` });
        }
        break;
      }

      // Find text on page
      case "FIND_TEXT": {
        const query = args.query;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node;
        const matches = [];
        while (node = walker.nextNode()) {
          if (node.textContent.toLowerCase().includes(query.toLowerCase())) {
            matches.push(node.textContent.trim().substring(0, 100));
            if (matches.length >= 5) break;
          }
        }
        sendResponse({ success: true, data: matches.length > 0 ? matches : "Text not found" });
        break;
      }

      // Get links
      case "GET_LINKS": {
        const links = Array.from(document.querySelectorAll("a"))
          .filter(isElementVisible)
          .slice(0, 30)
          .map(el => ({
            id: getOrAssignSidekickId(el),
            text: el.innerText.trim().substring(0, 50),
            href: el.href
          }));
        sendResponse({ success: true, data: links });
        break;
      }

      // Get buttons
      case "GET_BUTTONS": {
        const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"))
          .filter(isElementVisible)
          .slice(0, 30)
          .map(el => ({
            id: getOrAssignSidekickId(el),
            text: el.innerText.trim().substring(0, 50)
          }));
        sendResponse({ success: true, data: buttons });
        break;
      }

      // Get inputs
      case "GET_INPUTS": {
        const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']"))
          .filter(isElementVisible)
          .slice(0, 20)
          .map(el => ({
            id: getOrAssignSidekickId(el),
            text: (el.innerText || el.value || el.placeholder || "").trim().substring(0, 50),
            type: el.type || el.tagName.toLowerCase()
          }));
        sendResponse({ success: true, data: inputs });
        break;
      }

      // Get headings
      case "GET_HEADINGS": {
        const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"))
          .filter(isElementVisible)
          .slice(0, 15)
          .map(el => ({
            tag: el.tagName.toLowerCase(),
            text: el.innerText.trim().substring(0, 60)
          }));
        sendResponse({ success: true, data: headings });
        break;
      }

      // Get images
      case "GET_IMAGES": {
        const images = Array.from(document.querySelectorAll("img"))
          .filter(isElementVisible)
          .slice(0, 15)
          .map(el => ({
            id: getOrAssignSidekickId(el),
            src: el.src,
            alt: el.alt || ""
          }));
        sendResponse({ success: true, data: images });
        break;
      }

      // Clear input
      case "CLEAR_INPUT": {
        const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, [contenteditable='true']"));
        let el = null;
        if (args.target) {
          el = findBestMatch(inputs, args.target);
        }
        if (!el && inputs.length > 0) {
          el = inputs.find(isElementVisible);
        }
        if (el) {
          el.value = "";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: "Input cleared" });
        } else {
          sendResponse({ success: false, error: "No input found to clear" });
        }
        break;
      }

      // Paste text
      case "PASTE_TEXT": {
        const text = args.text;
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.hasAttribute("contenteditable"))) {
          activeEl.value = (activeEl.value || "") + text;
          activeEl.dispatchEvent(new Event("input", { bubbles: true }));
          sendResponse({ success: true, data: "Text pasted" });
        } else {
          sendResponse({ success: false, error: "No active text input found" });
        }
        break;
      }

      // Select dropdown
      case "SELECT_DROPDOWN": {
        const selects = Array.from(document.querySelectorAll("select"));
        let el = null;
        if (args.target) {
          el = findBestMatch(selects, args.target);
        }
        if (!el && selects.length > 0) {
          el = selects.find(isElementVisible);
        }
        if (el) {
          const option = Array.from(el.options).find(opt => 
            opt.value === args.value || opt.text.toLowerCase().includes(args.value.toLowerCase())
          );
          if (option) {
            el.value = option.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            sendResponse({ success: true, data: `Selected: ${option.text}` });
          } else {
            sendResponse({ success: false, error: `Option "${args.value}" not found` });
          }
        } else {
          sendResponse({ success: false, error: "No dropdown found" });
        }
        break;
      }

      // Check checkbox
      case "CHECK_CHECKBOX": {
        const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']"));
        let el = null;
        if (args.target) {
          el = findBestMatch(checkboxes, args.target);
        }
        if (!el && checkboxes.length > 0) {
          el = checkboxes.find(isElementVisible);
        }
        if (el) {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: "Checkbox checked" });
        } else {
          sendResponse({ success: false, error: "No checkbox found" });
        }
        break;
      }

      // Uncheck checkbox
      case "UNCHECK_CHECKBOX": {
        const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']"));
        let el = null;
        if (args.target) {
          el = findBestMatch(checkboxes, args.target);
        }
        if (!el && checkboxes.length > 0) {
          el = checkboxes.find(isElementVisible);
        }
        if (el) {
          el.checked = false;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          sendResponse({ success: true, data: "Checkbox unchecked" });
        } else {
          sendResponse({ success: false, error: "No checkbox found" });
        }
        break;
      }

      // Press key
      case "PRESS_KEY": {
        const key = args.key || "Enter";
        const activeEl = document.activeElement || document.body;
        const event = new KeyboardEvent('keydown', { 
          key: key, 
          code: key, 
          keyCode: key.charCodeAt(0), 
          bubbles: true 
        });
        activeEl.dispatchEvent(event);
        sendResponse({ success: true, data: `Pressed key: ${key}` });
        break;
      }

      // Extract emails
      case "EXTRACT_EMAILS": {
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        const text = document.body.innerText;
        const emails = text.match(emailRegex) || [];
        sendResponse({ success: true, data: [...new Set(emails)].slice(0, 10) });
        break;
      }

      // Extract phone numbers
      case "EXTRACT_PHONE_NUMBERS": {
        const phoneRegex = /[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,6}[-\s\.]?[0-9]{3,6}/g;
        const text = document.body.innerText;
        const phones = text.match(phoneRegex) || [];
        sendResponse({ success: true, data: [...new Set(phones)].slice(0, 10) });
        break;
      }

      // Extract dates
      case "EXTRACT_DATES": {
        const dateRegex = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/gi;
        const text = document.body.innerText;
        const dates = text.match(dateRegex) || [];
        sendResponse({ success: true, data: [...new Set(dates)].slice(0, 10) });
        break;
      }

      default:
        // Handle remaining tools as generic click or message routes
        sendResponse({ success: false, error: `DOM Action type not supported: ${type}` });
    }
  } catch (err) {
    sendResponse({ success: false, error: `Content error: ${err.message}` });
  }

  return true;
});
