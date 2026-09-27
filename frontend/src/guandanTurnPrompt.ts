export const GUANDAN_TURN_PROMPT_STORAGE_KEY = "guandan_turn_prompt";

export interface GuandanTurnPromptEligibility {
  readonly enabled: boolean;
  readonly connected: boolean;
  readonly gameStarted: boolean;
  readonly dealing: boolean;
  readonly seat: number | null;
  readonly turn: number | null;
  readonly handCount: number;
  readonly tributePending: boolean;
  readonly trickComplete: boolean;
  readonly nextRoundPending: boolean;
  readonly matchComplete: boolean;
  readonly playerFinished: boolean;
}

export const normalizeGuandanTurnPromptEnabled = (
  value: string | null,
): boolean => value !== "off";

export const shouldPlayGuandanTurnPrompt = (
  state: GuandanTurnPromptEligibility,
): boolean =>
  state.enabled &&
  state.connected &&
  state.gameStarted &&
  !state.dealing &&
  state.seat !== null &&
  state.turn === state.seat &&
  state.handCount > 0 &&
  !state.tributePending &&
  !state.trickComplete &&
  !state.nextRoundPending &&
  !state.matchComplete &&
  !state.playerFinished;

export const guandanTurnOpportunityKey = (
  tableClearId: number,
  passes: number,
  turn: number,
  tablePlays: ReadonlyArray<{ player: number; cards: readonly unknown[] }>,
): string =>
  `${tableClearId}|${passes}|${turn}|${tablePlays
    .map((play) => `${play.player}:${play.cards.length}`)
    .join(",")}`;

let promptContext: AudioContext | null = null;
let speechTimer: number | null = null;

const audioContext = (): AudioContext | null => {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (AudioContextClass === undefined) return null;
  promptContext ??= new AudioContextClass();
  return promptContext;
};

export const prepareGuandanTurnPrompt = (): void => {
  const context = audioContext();
  if (context === null) return;
  void context.resume().catch(() => undefined);
};

const playTurnChime = (context: AudioContext): void => {
  const now = context.currentTime;
  [659.25, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * 0.13;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.22);
  });
};

export const playGuandanTurnPrompt = (): void => {
  const context = audioContext();
  if (context !== null) {
    void context
      .resume()
      .then(() => playTurnChime(context))
      .catch(() => undefined);
  }

  if (
    window.speechSynthesis === undefined ||
    typeof SpeechSynthesisUtterance === "undefined"
  )
    return;
  if (speechTimer !== null) window.clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => {
    speechTimer = null;
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance("请出牌");
    message.lang = "zh-CN";
    message.rate = 0.92;
    message.pitch = 1;
    message.volume = 0.9;
    window.speechSynthesis.speak(message);
  }, 280);
};
