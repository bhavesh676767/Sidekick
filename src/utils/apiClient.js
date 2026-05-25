// src/utils/apiClient.js
// Wrapper to select between Groq and OpenRouter API providers.

export const getApiConfig = async () => {
  // Retrieve stored provider and keys from chrome.storage
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiProvider', 'groqApiKey', 'openRouterApiKey'], (result) => {
      const provider = result.apiProvider || 'groq';
      const apiKey = provider === 'openrouter' ? result.openRouterApiKey : result.groqApiKey;
      const baseUrl = provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.groq.com/openai/v1';
      resolve({ provider, apiKey, baseUrl });
    });
  });
};

export const callAiEndpoint = async (endpoint, payload) => {
  const { apiKey, baseUrl } = await getApiConfig();
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }
  return response.json();
};
