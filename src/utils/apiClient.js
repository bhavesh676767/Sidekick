// src/utils/apiClient.js
// Preference-based API provider selection with fallback support

/**
 * Get the next available API key based on preference order
 * Returns { provider, apiKey } for the first available key in preference order
 * If skipProvider is specified, it will skip that provider and try the next one
 */
export const getNextApiKey = async (skipProvider = null) => {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['geminiApiKey', 'groqApiKey', 'openRouterApiKey', 'apiPrefOrder'],
      (result) => {
        // Default preference order if not set
        let prefOrder = result.apiPrefOrder || ['gemini', 'groq', 'openrouter'];
        
        // Get all available keys
        const availableKeys = {
          gemini: result.geminiApiKey || null,
          groq: result.groqApiKey || null,
          openrouter: result.openRouterApiKey || null,
        };

        // Try to find the first available key in preference order
        for (const provider of prefOrder) {
          if (provider === skipProvider) continue; // Skip if we're asked to
          if (availableKeys[provider]) {
            return resolve({
              provider,
              apiKey: availableKeys[provider],
              baseUrl: getBaseUrlForProvider(provider),
            });
          }
        }

        // No available key found
        resolve(null);
      }
    );
  });
};

/**
 * Get base URL for a given provider
 */
function getBaseUrlForProvider(provider) {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    default:
      return '';
  }
}

/**
 * Call Gemini API
 */
export const callGeminiApi = async (apiKey, systemPrompt, userPrompt, history = [], retryPrompt = null) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const contents = [];
  for (const turn of history) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    });
  }
  
  contents.push({
    role: 'user',
    parts: [{ text: retryPrompt ? retryPrompt : userPrompt }],
  });

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Received empty response from Gemini');
  }
  return text.trim();
};

/**
 * Legacy endpoint for compatibility (if needed)
 */
export const getApiConfig = async () => {
  const config = await getNextApiKey();
  if (!config) {
    throw new Error('No API keys configured');
  }
  return config;
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
