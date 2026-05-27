(function () {
  self.SidekickWorkflowPacks = self.SidekickWorkflowPacks || [];
  self.SidekickWorkflowPacks.push({
    category: "productivity",
    workflows: [
      {
        id: "open_website",
        name: "Open Website",
        triggers: ["open", "go to", "launch", "visit"],
        requiredSlots: ["site"],
        optionalSlots: [],
        steps: ["resolve_site", "open_new_tab", "done"],
        followups: [],
        safetyRules: ["Open new tabs by default"]
      },
      {
        id: "tab_cleanup",
        name: "Tab Cleanup",
        triggers: ["clean my tabs", "close duplicate tabs", "tab cleanup"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["list_tabs", "find_duplicates", "suggest_cleanup", "ask_before_closing"],
        followups: [{ key: "closeTabs", question: "Close duplicate tabs?", buttons: ["Close duplicates", "Show list", "Cancel", "Don't ask again"] }],
        safetyRules: ["Never close tabs without confirmation"]
      },
      {
        id: "group_tabs",
        name: "Group Tabs",
        triggers: ["group my tabs", "organize tabs"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["classify_tabs", "create_groups", "save_grouping"],
        followups: [],
        safetyRules: ["Do not close tabs"]
      },
      {
        id: "resume_work",
        name: "Resume Work",
        triggers: ["resume my work", "continue my work", "restore workspace"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["load_last_workspace", "reopen_tabs", "restore_context"],
        followups: [],
        safetyRules: ["Do not close current tabs automatically"]
      },
      {
        id: "focus_mode",
        name: "Focus Mode",
        triggers: ["focus mode", "help me focus"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["detect_distractions", "mute_or_pin_useful_tabs", "ask_before_hiding"],
        followups: [{ key: "focusModeAction", question: "Focus mode?", buttons: ["Mute distractions", "Pin useful", "Show plan", "Cancel"] }],
        safetyRules: ["Ask before hiding or closing tabs"]
      },
      {
        id: "save_page",
        name: "Save Page / Link",
        triggers: ["save this", "save page", "remember this link"],
        requiredSlots: [],
        optionalSlots: ["summary"],
        steps: ["save_url_title_summary", "add_to_memory"],
        followups: [],
        safetyRules: []
      },
      {
        id: "find_in_page",
        name: "Find in Page",
        triggers: ["find", "scroll to", "highlight"],
        requiredSlots: ["text"],
        optionalSlots: [],
        steps: ["search_visible_text", "scroll_to_match", "highlight"],
        followups: [],
        safetyRules: []
      },
      {
        id: "zoom_readability",
        name: "Zoom / Readability",
        triggers: ["zoom in", "zoom out", "make text bigger", "reset zoom"],
        requiredSlots: ["direction"],
        optionalSlots: ["rememberSite"],
        steps: ["adjust_zoom", "optionally_remember_site"],
        followups: [],
        safetyRules: ["Only zoom when user asks"]
      },
      {
        id: "meeting_prep",
        name: "Meeting Prep",
        triggers: ["prep me for meeting", "meeting prep"],
        requiredSlots: ["topic"],
        optionalSlots: [],
        steps: ["collect_related_tabs_notes", "summarize", "generate_talking_points"],
        followups: [],
        safetyRules: ["Use local tabs and saved notes only unless user asks for research"]
      }
    ]
  });
})();
