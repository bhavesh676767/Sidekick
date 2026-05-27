const SIDEKICK_MEMORY_DEFAULT = {
  preferences: {
    likesFullscreenYoutube: false,
    preferredSearchEngine: "google",
    prefersVoiceReplies: true,
    likesSummaries: true,
    dismissedFormTooltipSites: [],
    dismissedWritingTooltipSites: [],
    preferredWritingTone: "simple",
    prefersShortReplies: true,
    formFillStyle: "ask_step_by_step",
    neverAutoSubmitForms: true
  },
  interactionPatterns: {},
  recentCommands: [],
  learnedBehaviors: []
};

function cloneSidekickMemoryDefault() {
  return JSON.parse(JSON.stringify(SIDEKICK_MEMORY_DEFAULT));
}

async function getSidekickMemory() {
  const stored = await chrome.storage.local.get("sidekickMemory");
  return {
    ...cloneSidekickMemoryDefault(),
    ...(stored.sidekickMemory || {}),
    preferences: {
      ...SIDEKICK_MEMORY_DEFAULT.preferences,
      ...(stored.sidekickMemory?.preferences || {})
    },
    interactionPatterns: stored.sidekickMemory?.interactionPatterns || {},
    recentCommands: stored.sidekickMemory?.recentCommands || [],
    learnedBehaviors: stored.sidekickMemory?.learnedBehaviors || []
  };
}

async function saveSidekickMemory(memory) {
  await chrome.storage.local.set({ sidekickMemory: memory });
  return memory;
}

async function rememberSidekickCommand(command, source = "text") {
  const memory = await getSidekickMemory();
  const recentCommands = [
    { command, source, at: Date.now() },
    ...memory.recentCommands
  ].slice(0, 30);

  const key = String(command || "").toLowerCase().includes("summarize") ? "summarize_page" : "general";
  const pattern = memory.interactionPatterns[key] || { count: 0, lastAt: 0 };
  memory.interactionPatterns[key] = { count: pattern.count + 1, lastAt: Date.now() };
  memory.recentCommands = recentCommands;
  return saveSidekickMemory(memory);
}

async function recordFollowupOutcome(followupKey, accepted) {
  const memory = await getSidekickMemory();
  const key = `followup:${followupKey}`;
  const pattern = memory.interactionPatterns[key] || { accepted: 0, rejected: 0 };
  if (accepted) pattern.accepted += 1;
  else pattern.rejected += 1;
  pattern.lastAt = Date.now();
  memory.interactionPatterns[key] = pattern;

  if (followupKey === "youtube_fullscreen" && pattern.rejected >= 3) {
    memory.preferences.likesFullscreenYoutube = false;
    if (!memory.learnedBehaviors.includes("skip_youtube_fullscreen_prompt")) {
      memory.learnedBehaviors.push("skip_youtube_fullscreen_prompt");
    }
  }

  return saveSidekickMemory(memory);
}

async function updateSidekickPreferences(preferences = {}) {
  const memory = await getSidekickMemory();
  memory.preferences = { ...memory.preferences, ...preferences };
  return saveSidekickMemory(memory);
}
