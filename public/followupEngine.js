function normalizeSidekickCommand(command) {
  return String(command || "").toLowerCase().trim();
}

function shouldAskSidekickFollowup({ command, memory, context = {} }) {
  const lower = normalizeSidekickCommand(command);
  if (!lower) return null;

  const rejectedFullscreen = memory?.interactionPatterns?.["followup:youtube_fullscreen"]?.rejected || 0;
  const skipFullscreen = memory?.learnedBehaviors?.includes("skip_youtube_fullscreen_prompt") || rejectedFullscreen >= 3;
  const looksLikeYoutubePlayback = /\b(play|search|find|show)\b/.test(lower) && /\b(youtube|yt|video|song|lofi|music)\b/.test(lower);

  if (looksLikeYoutubePlayback && !skipFullscreen) {
    return {
      key: "youtube_fullscreen",
      question: "Want fullscreen?",
      suggestedCommand: "youtube fullscreen",
      when: "after_success"
    };
  }

  if (/^(search|google|find)\b/.test(lower) && /\bnotes?\b/.test(lower) && !/\b(class|grade|college|beginner|advanced|level)\b/.test(lower)) {
    return {
      key: "notes_level",
      question: "Any class or level?",
      when: "before_ambiguous"
    };
  }

  const summarizePattern = memory?.interactionPatterns?.summarize_page?.count || 0;
  if (!/\bsummarize\b/.test(lower) && summarizePattern >= 3 && context?.hasReadablePage) {
    return {
      key: "quick_summary",
      question: "Want a quick summary too?",
      suggestedCommand: "summarize page",
      when: "after_success"
    };
  }

  return null;
}

function isAffirmativeFollowupReply(text) {
  return /\b(yes|yeah|yep|sure|ok|okay|do it|please|continue)\b/i.test(String(text || ""));
}

function isNegativeFollowupReply(text) {
  return /\b(no|nah|nope|don't|dont|skip|stop|not now)\b/i.test(String(text || ""));
}
