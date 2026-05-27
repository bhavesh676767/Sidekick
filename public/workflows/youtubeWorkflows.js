(function () {
  self.SidekickWorkflowPacks = self.SidekickWorkflowPacks || [];
  self.SidekickWorkflowPacks.push({
    category: "youtube",
    workflows: [
      {
        id: "youtube_search_play",
        name: "YouTube Search + Play",
        triggers: ["play", "youtube", "watch"],
        requiredSlots: ["query"],
        optionalSlots: ["fullscreen"],
        steps: ["open_youtube_search", "open_first_relevant_video", "ask_fullscreen_preference"],
        followups: [{ key: "youtubeFullscreen", question: "Fullscreen it?", buttons: ["Yes", "No", "Don't ask again", "Always fullscreen"] }],
        safetyRules: ["Do not click age-restricted or suspicious results"]
      },
      {
        id: "youtube_timestamp",
        name: "YouTube Timestamp",
        triggers: ["go to", "seek", "skip to"],
        requiredSlots: ["timestamp"],
        optionalSlots: [],
        steps: ["detect_youtube_video", "parse_timestamp", "seek_video"],
        followups: [],
        safetyRules: []
      }
    ]
  });
})();
