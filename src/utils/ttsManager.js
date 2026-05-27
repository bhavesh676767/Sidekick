export const supportsSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

const preferredVoiceNames = [
  "Microsoft Aria",
  "Microsoft Jenny",
  "Google UK English",
  "Google US English",
  "Google UK English Female"
];

export function getAvailableVoices() {
  if (!supportsSpeechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

function waitForVoices(timeoutMs = 1500) {
  if (!supportsSpeechSynthesis) return Promise.resolve([]);
  const existing = getAvailableVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.onvoiceschanged = null;
      resolve(getAvailableVoices());
    };
    window.speechSynthesis.onvoiceschanged = finish;
    setTimeout(finish, timeoutMs);
  });
}

export function pickBestVoice(voices, preferredVoice) {
  if (!voices.length) return null;
  if (preferredVoice) {
    const exact = voices.find((voice) => voice.name === preferredVoice);
    if (exact) return exact;
  }
  for (const name of preferredVoiceNames) {
    const match = voices.find((voice) => voice.name.toLowerCase().includes(name.toLowerCase()));
    if (match) return match;
  }
  return voices.find((voice) => /^en[-_]/i.test(voice.lang)) || voices[0];
}

export function createTtsManager({ onStateChange = () => {} } = {}) {
  let currentVoiceName = "";
  let currentRate = 1;
  let speakToken = 0;

  const setState = (state, detail = {}) => {
    onStateChange({ state, supported: supportsSpeechSynthesis, ...detail });
  };

  const stopSpeaking = () => {
    if (!supportsSpeechSynthesis) return;
    speakToken += 1;
    window.speechSynthesis.cancel();
    setState("idle");
  };

  const setVoice = (voiceName) => {
    currentVoiceName = voiceName || "";
  };

  const setRate = (rate) => {
    currentRate = Number(rate || 1);
  };

  const speak = async (text, options = {}) => {
    if (!supportsSpeechSynthesis || !text || options.muted) {
      setState("idle");
      return false;
    }

    stopSpeaking();
    const token = ++speakToken;
    const voices = await waitForVoices();
    const utterance = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, " ").trim());
    const voice = pickBestVoice(voices, options.voiceName || currentVoiceName);
    if (voice) utterance.voice = voice;
    utterance.rate = Number(options.rate || currentRate || 1);
    utterance.pitch = 1;
    utterance.volume = options.volume ?? 1;

    utterance.onstart = () => {
      if (token === speakToken) setState("speaking", { text });
    };
    utterance.onend = () => {
      if (token === speakToken) setState("idle");
    };
    utterance.onerror = () => {
      if (token === speakToken) setState("error", { message: "I couldn't speak that." });
    };

    window.speechSynthesis.speak(utterance);
    return true;
  };

  return {
    speak,
    stopSpeaking,
    stop: stopSpeaking,
    setVoice,
    setRate,
    getVoices: getAvailableVoices,
    isSupported: () => supportsSpeechSynthesis
  };
}
