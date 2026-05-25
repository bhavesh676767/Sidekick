// Background script for Chrome extension
// Handles long-running tasks, API calls, and communication between popup and content scripts

chrome.runtime.onInstalled.addListener(() => {
  console.log('Sidekick extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    // Handle page summarization
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getContent' }, (response) => {
        sendResponse({ status: 'processing', data: response });
      });
    });
    return true;
  }
  
  if (request.action === 'executeTask') {
    // Handle task execution
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, request.data, (response) => {
        sendResponse({ status: 'success', data: response });
      });
    });
    return true;
  }
});
