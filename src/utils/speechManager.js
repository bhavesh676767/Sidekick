const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const supportsSpeechRecognition = Boolean(SpeechRecognition);

export function createSpeechManager({
  onStateChange = () => {},
  onInterim = () => {},
  onWakeWord = () => {},
  onFinal = () => {},
  onError = () => {}
} = {}) {
  let recognition = null;
  let isListening = false;
  let isStarting = false;
  let shouldRestart = false;
  let restartTimer = null;
  let mode = "manual";
  let wakeWord = "sidekick";
  let awaitingWakeCommand = false;
  let lastTranscript = "";
  let lastTranscriptAt = 0;

  const normalize = (text) => String(text || "").toLowerCase().trim().replace(/\s+/g, " ");

  const setState = (state, detail = {}) => {
    onStateChange({ state, supported: supportsSpeechRecognition, ...detail });
  };

  const clearRestartTimer = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const scheduleRestart = () => {
    clearRestartTimer();
    restartTimer = setTimeout(() => {
      if (shouldRestart && mode === "wake_word") {
        start({ mode, wakeWord });
      }
    }, 500);
  };

  const isDuplicate = (text) => {
    const now = Date.now();
    if (text === lastTranscript && now - lastTranscriptAt < 2500) return true;
    lastTranscript = text;
    lastTranscriptAt = now;
    return false;
  };

  const createRecognition = () => {
    if (!supportsSpeechRecognition) return null;
    const instance = new SpeechRecognition();
    instance.lang = "en-US";
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    instance.continuous = true;

    instance.onstart = () => {
      isStarting = false;
      isListening = true;
      setState(mode === "wake_word" ? "wake_listening" : "listening");
    };

    instance.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = String(event.results[i][0]?.transcript || "").trim();
        if (!text) continue;
        if (event.results[i].isFinal) final += `${text} `;
        else interim += `${text} `;
      }

      const cleanInterim = interim.trim();
      if (cleanInterim) {
        onInterim(cleanInterim);
      }

      const cleanFinal = final.trim();
      if (!cleanFinal) return;
      const normalizedFinal = normalize(cleanFinal);
      if (isDuplicate(normalizedFinal)) return;

      if (mode === "wake_word") {
        const normalizedWakeWord = normalize(wakeWord);
        if (normalizedFinal.includes(normalizedWakeWord)) {
          const wakeIndex = normalizedFinal.indexOf(normalizedWakeWord);
          const afterWake = normalizedFinal.slice(wakeIndex + normalizedWakeWord.length).trim();
          if (afterWake) {
            shouldRestart = false;
            stop({ silent: true });
            onFinal(afterWake, { wakeWord: true });
            return;
          }
          awaitingWakeCommand = true;
          onWakeWord();
          setState("listening");
          return;
        }

        if (awaitingWakeCommand) {
          awaitingWakeCommand = false;
          shouldRestart = false;
          stop({ silent: true });
          onFinal(cleanFinal.trim(), { wakeWord: true });
          return;
        }

        return;
      }

      shouldRestart = false;
      stop({ silent: true });
      onFinal(cleanFinal.trim(), { wakeWord: false });
    };

    instance.onerror = (event) => {
      isStarting = false;
      isListening = false;

      if (event.error === "already-started") return;
      if (event.error === "aborted") {
        if (shouldRestart && mode === "wake_word") scheduleRestart();
        return;
      }
      if (event.error === "no-speech") {
        if (mode === "wake_word") {
          scheduleRestart();
          return;
        }
        return;
      }

      const message = event.error === "not-allowed"
        ? "Microphone permission is blocked."
        : event.error === "network"
          ? "Voice is not supported in this browser."
          : "I couldn't hear that.";

      setState("error", { error: event.error, message });
      onError({ error: event.error, message });
    };

    instance.onend = () => {
      isListening = false;
      isStarting = false;
      if (shouldRestart && mode === "wake_word") {
        scheduleRestart();
        return;
      }
      if (!shouldRestart) {
        awaitingWakeCommand = false;
        setState("idle");
      }
    };

    return instance;
  };

  const start = (options = {}) => {
    if (!supportsSpeechRecognition) {
      setState("error", { message: "Voice is not supported in this browser." });
      return false;
    }

    mode = options.mode || "manual";
    wakeWord = options.wakeWord || "sidekick";
    shouldRestart = mode === "wake_word";
    clearRestartTimer();
    if (!recognition) recognition = createRecognition();
    recognition.continuous = mode === "wake_word";

    if (isListening || isStarting) return true;

    try {
      isStarting = true;
      recognition.start();
      return true;
    } catch (err) {
      isStarting = false;
      if (/already started/i.test(err.message || "")) return true;
      setState("error", { message: "Voice is not supported in this browser." });
      onError({ error: "network", message: "Voice is not supported in this browser." });
      return false;
    }
  };

  const stop = ({ silent = false } = {}) => {
    clearRestartTimer();
    shouldRestart = false;
    awaitingWakeCommand = false;
    if (!recognition || (!isListening && !isStarting)) {
      if (!silent) setState("idle");
      return;
    }
    try {
      recognition.stop();
    } catch (err) {
      if (!silent) setState("idle");
    }
  };

  const abort = () => {
    clearRestartTimer();
    shouldRestart = false;
    awaitingWakeCommand = false;
    if (recognition) {
      try {
        recognition.abort();
      } catch (err) {
        // Ignore stale aborts.
      }
    }
    isListening = false;
    isStarting = false;
    setState("idle");
  };

  return {
    start,
    stop,
    abort,
    isSupported: () => supportsSpeechRecognition,
    isListening: () => isListening
  };
}
