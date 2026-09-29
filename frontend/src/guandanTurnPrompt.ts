let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) return null;
  try {
    audioContext ??= new AudioContextConstructor();
    return audioContext;
  } catch {
    return null;
  }
};

/** Resume audio synchronously from a player's gesture for mobile browser policies. */
export const unlockGuandanTurnPromptAudio = (): void => {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
};

/** Notify only the player whose turn it is: a soft beep followed by speech. */
export const playGuandanTurnPrompt = (): void => {
  const context = getAudioContext();
  if (context !== null) {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    } catch {
      // Sound is best-effort; continue to the voice prompt if audio is unavailable.
    }
  }

  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  ) {
    const utterance = new SpeechSynthesisUtterance("请出牌");
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.setTimeout(() => window.speechSynthesis.speak(utterance), 140);
  }
};
