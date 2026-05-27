(function () {
  self.SidekickWorkflowPacks = self.SidekickWorkflowPacks || [];
  self.SidekickWorkflowPacks.push({
    category: "writing",
    workflows: [
      {
        id: "write_email",
        name: "Write Email",
        triggers: ["write an email", "draft email", "email to"],
        requiredSlots: ["prompt"],
        optionalSlots: ["tone", "recipient"],
        steps: ["detect_editor", "draft_email", "insert_draft", "ask_before_send"],
        followups: [],
        safetyRules: ["Never send email without confirmation"]
      },
      {
        id: "rewrite_selected_text",
        name: "Rewrite Selected Text",
        triggers: ["make this formal", "rewrite this", "make this professional", "make this shorter", "make it simple"],
        requiredSlots: [],
        optionalSlots: ["tone"],
        steps: ["get_selected_text", "rewrite", "replace_after_confirmation"],
        followups: [],
        safetyRules: ["Keep undo copy before replacement"]
      },
      {
        id: "fix_grammar",
        name: "Fix Grammar",
        triggers: ["fix grammar", "correct grammar", "grammar check"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["get_selected_or_editor_text", "correct", "replace"],
        followups: [],
        safetyRules: ["Keep undo copy before replacement"]
      },
      {
        id: "reply_draft",
        name: "Reply Draft",
        triggers: ["reply politely", "write a reply", "draft reply"],
        requiredSlots: ["prompt"],
        optionalSlots: ["tone"],
        steps: ["read_context", "draft_reply", "insert", "ask_before_send"],
        followups: [],
        safetyRules: ["Never send message without confirmation"]
      }
    ]
  });
})();
