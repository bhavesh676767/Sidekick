(function () {
  self.SidekickWorkflowPacks = self.SidekickWorkflowPacks || [];
  self.SidekickWorkflowPacks.push({
    category: "forms",
    workflows: [
      {
        id: "fill_form_stepwise",
        name: "Fill Form",
        triggers: ["fill this form", "help me apply", "fill form"],
        requiredSlots: [],
        optionalSlots: ["mode"],
        steps: ["detect_fields", "ask_one_question_per_field", "fill_answers", "review", "ask_before_submit"],
        followups: [{ key: "submitForm", question: "Submit now?", buttons: ["Submit", "Review", "Edit", "Cancel"] }],
        safetyRules: ["Never submit without confirmation", "Ask before sensitive fields"]
      },
      {
        id: "auto_form_suggestion",
        name: "Auto Form Suggestion",
        triggers: ["form detected"],
        requiredSlots: [],
        optionalSlots: [],
        steps: ["show_tooltip"],
        followups: [],
        safetyRules: ["Do not show repeatedly after dismissal"]
      }
    ]
  });
})();
