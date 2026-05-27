(function () {
  const packs = self.SidekickWorkflowPacks || [];
  const workflows = packs.flatMap((pack) => pack.workflows.map((workflow) => ({ ...workflow, category: pack.category })));

  const SITE_ALIASES = {
    youtube: "https://www.youtube.com",
    gmail: "https://mail.google.com",
    google: "https://www.google.com",
    amazon: "https://www.amazon.in",
    flipkart: "https://www.flipkart.com",
    github: "https://github.com",
    reddit: "https://www.reddit.com",
    linkedin: "https://www.linkedin.com",
    notion: "https://www.notion.so",
    docs: "https://docs.google.com",
    calendar: "https://calendar.google.com",
    maps: "https://www.google.com/maps",
    x: "https://x.com",
    twitter: "https://x.com",
    instagram: "https://www.instagram.com",
    discord: "https://discord.com/app"
  };

  function cleanCommand(command) {
    return String(command || "").trim().replace(/\s+/g, " ");
  }

  function stripLead(command, words) {
    let value = cleanCommand(command);
    for (const word of words) {
      value = value.replace(new RegExp(`^${word}\\s+`, "i"), "");
    }
    return value.trim();
  }

  function hasTrigger(command, workflow) {
    const lower = command.toLowerCase();
    return workflow.triggers.some((trigger) => lower.includes(trigger));
  }

  function timestamp(command) {
    return command.match(/\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b|\b\d+\s*(?:h|hr|hour|m|min|minute|s|sec|second)s?\b/i)?.[0] || "";
  }

  function extractSlots(command, workflowId) {
    const lower = command.toLowerCase();
    if (workflowId === "open_website") {
      const site = stripLead(command, ["open", "go to", "launch", "visit"]).toLowerCase();
      const key = Object.keys(SITE_ALIASES).find((alias) => site === alias || site.includes(alias));
      return { site: site || "", url: key ? SITE_ALIASES[key] : "" };
    }
    if (workflowId === "youtube_timestamp") return { timestamp: timestamp(command) };
    if (workflowId === "find_in_page") {
      return { text: stripLead(command, ["find", "scroll to", "highlight"]).replace(/\b(?:section|text)\b/gi, "").trim() };
    }
    if (workflowId === "zoom_readability") {
      return { direction: lower.includes("out") ? "out" : lower.includes("reset") ? "reset" : "in" };
    }
    if (workflowId === "write_email" || workflowId === "reply_draft") return { prompt: command };
    if (workflowId === "meeting_prep") return { topic: stripLead(command, ["prep me for meeting about", "meeting prep"]) };
    return {
      query: stripLead(command, [
        "search",
        "google",
        "look up",
        "research",
        "find best",
        "find cheapest",
        "find cheap",
        "find",
        "play",
        "watch",
        "youtube"
      ])
    };
  }

  function detect(command, memory = {}) {
    const clean = cleanCommand(command);
    const lower = clean.toLowerCase();
    const preferences = memory.preferences || {};

    let workflow = null;
    if (/^(open|go to|launch|visit)\s+/i.test(clean)) workflow = workflows.find((item) => item.id === "open_website");
    else if (/\b(?:go to|seek|skip to)\s+(?:\d{1,2}:)?\d{1,2}:\d{2}\b/i.test(clean)) workflow = workflows.find((item) => item.id === "youtube_timestamp");
    else if (/^(zoom in|zoom out|reset zoom|make text bigger)/i.test(clean)) workflow = workflows.find((item) => item.id === "zoom_readability");
    else if (/summarize this (?:page|webpage)|summarize page/i.test(clean)) workflow = workflows.find((item) => item.id === "summarize_page");
    else if (/what is this page about|explain this page/i.test(clean)) workflow = workflows.find((item) => item.id === "explain_page_simply");
    else if (/make notes|extract notes|notes from this/i.test(clean)) workflow = workflows.find((item) => item.id === "extract_notes");
    else if (/get contact details|extract contact|find email|contact info/i.test(clean)) workflow = workflows.find((item) => item.id === "extract_contact_info");
    else if (/fix grammar|correct grammar|grammar check/i.test(clean)) workflow = workflows.find((item) => item.id === "fix_grammar");
    else if (/make this formal|rewrite this|make this professional|make this shorter|make it simple/i.test(clean)) workflow = workflows.find((item) => item.id === "rewrite_selected_text");
    else if (/write an email|draft email|email to/i.test(clean)) workflow = workflows.find((item) => item.id === "write_email");
    else if (/reply politely|write a reply|draft reply/i.test(clean)) workflow = workflows.find((item) => item.id === "reply_draft");
    else if (/fill this form|help me apply|fill form/i.test(clean)) workflow = workflows.find((item) => item.id === "fill_form_stepwise");
    else if (/compare these|compare products|compare laptops|compare phones/i.test(clean)) workflow = workflows.find((item) => item.id === "compare_products");
    else if (/find discount|coupon|deal check|promo code/i.test(clean)) workflow = workflows.find((item) => item.id === "coupon_deal_check");
    else if (/cheapest|lowest price|cheap/i.test(clean) && /(find|search|buy|product|keyboard|laptop|phone|hoodie|shoe)/i.test(clean)) workflow = workflows.find((item) => item.id === "cheapest_product");
    else if (/(hoodie|shirt|jeans|jacket|sneakers|dress)/i.test(clean) && /(find|buy|search)/i.test(clean)) workflow = workflows.find((item) => item.id === "clothing_search");
    else if (/(find|search|buy).*(best|recommend|value for money|under\s+\d)/i.test(clean)) workflow = workflows.find((item) => item.id === "find_best_product");
    else if (/^(play|watch).+/i.test(clean) || /\byoutube\b/i.test(clean)) workflow = workflows.find((item) => item.id === "youtube_search_play");
    else if (/^(search|google|look up)\s+/i.test(clean)) workflow = workflows.find((item) => item.id === "search_web");
    else if (/react|library|npm|github|coding/i.test(clean) && /(find|research|compare|search)/i.test(clean)) workflow = workflows.find((item) => item.id === "coding_research");
    else if (/summarize this repo|explain this repo|repo summary/i.test(clean)) workflow = workflows.find((item) => item.id === "github_repo_summary");
    else if (/research|final report|generate report/i.test(clean)) workflow = workflows.find((item) => item.id === "research_topic");
    else if (/clean my tabs|close duplicate tabs|tab cleanup/i.test(clean)) workflow = workflows.find((item) => item.id === "tab_cleanup");
    else if (/group my tabs|organize tabs/i.test(clean)) workflow = workflows.find((item) => item.id === "group_tabs");
    else if (/resume my work|continue my work|restore workspace/i.test(clean)) workflow = workflows.find((item) => item.id === "resume_work");
    else if (/focus mode|help me focus/i.test(clean)) workflow = workflows.find((item) => item.id === "focus_mode");
    else if (/save this|save page|remember this link/i.test(clean)) workflow = workflows.find((item) => item.id === "save_page");
    else if (/^(find|scroll to|highlight)\s+/i.test(clean)) workflow = workflows.find((item) => item.id === "find_in_page");
    else if (/prep me for meeting|meeting prep/i.test(clean)) workflow = workflows.find((item) => item.id === "meeting_prep");

    if (!workflow || !hasTrigger(lower, workflow)) return null;
    const slots = extractSlots(clean, workflow.id);
    const missing = workflow.requiredSlots.filter((slot) => !slots[slot]);
    return {
      workflow,
      slots,
      missing,
      preferences,
      tool: "run_workflow",
      args: { workflowId: workflow.id, command: clean, slots }
    };
  }

  function list() {
    return workflows;
  }

  self.SidekickWorkflows = { list, detect, SITE_ALIASES };
})();
