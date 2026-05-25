// Sidekick — Content script
// Injected into every page to perform DOM actions on behalf of the popup.

console.log("Sidekick content script loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Return the visible text of the page (for summarization)
  if (msg.type === "GET_PAGE_TEXT") {
    sendResponse({ text: document.body.innerText.substring(0, 8000) });
    return;
  }

  // Scroll the page up or down
  if (msg.type === "SCROLL") {
    const amount = msg.direction === "up" ? -500 : 500;
    window.scrollBy({ top: amount, behavior: "smooth" });
    sendResponse({ success: true });
    return;
  }

  // Find a visible element whose text matches and click it
  if (msg.type === "CLICK_TEXT") {
    const target = msg.text.toLowerCase();
    const clickable = [...document.querySelectorAll("a, button, [role='button'], input[type='submit'], input[type='button']")];
    const match = clickable.find((el) => {
      const label = (el.innerText || el.value || el.getAttribute("aria-label") || "").toLowerCase();
      return label.includes(target) && el.offsetParent !== null; // visible
    });
    if (match) {
      match.click();
      sendResponse({ success: true, clicked: match.innerText || match.value || "" });
    } else {
      sendResponse({ success: false, error: "No matching element found" });
    }
    return;
  }

  // Type text into the focused input or the first visible input
  if (msg.type === "TYPE_TEXT") {
    let input = document.activeElement;
    if (!input || !["INPUT", "TEXTAREA"].includes(input.tagName)) {
      input = document.querySelector("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea");
    }
    if (input) {
      input.focus();
      input.value = msg.text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No input field found" });
    }
    return;
  }
});
