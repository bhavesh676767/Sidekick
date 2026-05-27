(function () {
  self.SidekickWorkflowPacks = self.SidekickWorkflowPacks || [];
  self.SidekickWorkflowPacks.push({
    category: "research",
    workflows: [
      {
        id: "search_web",
        name: "Search Web",
        triggers: ["search", "google", "look up"],
        requiredSlots: ["query"],
        optionalSlots: ["openFirstResult"],
        steps: ["open_google_search", "extract_results", "optionally_open_best_result"],
        followups: [{ key: "openFirstResult", question: "Open first result?", buttons: ["Yes", "No", "Show results", "Always ask"] }],
        safetyRules: ["Open new tabs by default"]
      },
      {
        id: "summarize_page",
        name: "Summarize Current Page",
        triggers: ["summarize this page", "summarize page", "summarize this webpage"],
        requiredSlots: [],
        optionalSlots: ["length"],
        steps: ["extract_readable_content", "summarize", "show_summary"],
        followups: [],
        safetyRules: ["Use visible public page content only"]
      },
      {
        id: "explain_page_simply",
        name: "Explain Page Simply",
        triggers: ["what is this page about", "explain this page", "explain simply"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["extract_page", "explain_simple"],
        followups: [],
        safetyRules: ["Use visible public page content only"]
      },
      {
        id: "extract_notes",
        name: "Extract Notes",
        triggers: ["make notes", "extract notes", "notes from this"],
        requiredSlots: [],
        optionalSlots: ["save"],
        steps: ["readability_extract", "extract_headings", "make_bullet_notes", "save_notes"],
        followups: [],
        safetyRules: ["Use visible public page content only"]
      },
      {
        id: "research_topic",
        name: "Research Topic",
        triggers: ["research", "final report", "generate report"],
        requiredSlots: ["query"],
        optionalSlots: ["depth"],
        steps: ["search_web", "open_top_sources", "extract_summaries", "compare", "generate_report"],
        followups: [{ key: "researchDepth", question: "Depth?", buttons: ["Quick", "Detailed", "Sources only", "Save as notes"] }],
        safetyRules: ["Do not bypass logins, paywalls, or CAPTCHAs"]
      },
      {
        id: "coding_research",
        name: "Coding Research",
        triggers: ["react", "library", "npm", "github", "coding"],
        requiredSlots: ["query"],
        optionalSlots: [],
        steps: ["search_github_npm", "extract_repo_package_info", "compare"],
        followups: [],
        safetyRules: ["Use visible repo/package data only"]
      },
      {
        id: "github_repo_summary",
        name: "GitHub Repo Summary",
        triggers: ["summarize this repo", "explain this repo", "repo summary"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["read_readme", "extract_purpose", "summarize_setup"],
        followups: [],
        safetyRules: ["Use visible README data only"]
      },
      {
        id: "extract_contact_info",
        name: "Extract Contact Info",
        triggers: ["get contact details", "extract contact", "find email", "contact info"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["extract_emails", "extract_phones", "extract_contact_links", "show_clean_list"],
        followups: [],
        safetyRules: ["Extract visible public data only"]
      }
    ]
  });
})();
