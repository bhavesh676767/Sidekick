// Sidekick — Background service worker (Manifest V3)
// Handles extension lifecycle events and tab creation requests from the popup.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Sidekick extension installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "OPEN_TAB") {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // keep channel open for async response
  }
});
