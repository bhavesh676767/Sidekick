console.log("Sidekick content script running");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_PAGE_TEXT") {
    sendResponse({
      text: document.body.innerText
    });
  }
});
