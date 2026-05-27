const GUIDE_STORAGE_KEY = "sidekick_guide_state";

export async function saveGuideState(state) {
  const toSave = {
    ...state,
    lastUpdated: Date.now()
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [GUIDE_STORAGE_KEY]: toSave }, resolve);
  });
}

export async function loadGuideState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(GUIDE_STORAGE_KEY, (data) => {
      resolve(data[GUIDE_STORAGE_KEY] || null);
    });
  });
}

export async function clearGuideState() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(GUIDE_STORAGE_KEY, resolve);
  });
}
