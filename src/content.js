// Content script for Chrome extension
// Runs on every webpage and can interact with the DOM

console.log('Sidekick content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getContent') {
    // Get page content for summarization
    const content = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 5000), // First 5000 chars
    };
    sendResponse(content);
  }
  
  if (request.action === 'clickElement') {
    // Click an element
    const elements = document.querySelectorAll(request.selector);
    if (elements.length > 0) {
      elements[0].click();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Element not found' });
    }
  }
  
  if (request.action === 'fillForm') {
    // Fill form fields
    const fields = document.querySelectorAll(request.selector);
    fields.forEach((field, idx) => {
      if (idx < request.values.length) {
        field.value = request.values[idx];
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    sendResponse({ success: true });
  }
});
