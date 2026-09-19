export type GuandanMusicMode = "off" | "relaxing" | "chinese";

export interface GuandanMusicPreset {
  readonly label: string;
  readonly frequencies: readonly number[];
  readonly intervalMs: number;
  readonly oscillator: OscillatorType;
}

export const GUANDAN_MUSIC_PRESETS: Record<
  Exclude<GuandanMusicMode, "off">,
  GuandanMusicPreset
> = {
  relaxing: {
    label: "轻松气氛器乐",
    frequencies: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23],
    intervalMs: 620,
    oscillator: "sine",
  },
  chinese: {
    label: "中国民乐",
    frequencies: [293.66, 349.23, 392, 440, 523.25, 440, 392, 349.23],
    intervalMs: 480,
    oscillator: "triangle",
  },
};

export const normalizeGuandanMusicMode = (
  value: string | null,
): GuandanMusicMode =>
  value === "relaxing" || value === "chinese" ? value : "off";

export const startGuandanMusic = (
  mode: Exclude<GuandanMusicMode, "off">,
): (() => void) => {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (AudioContextClass === undefined) return () => undefined;

  const context = new AudioContextClass();
  const preset = GUANDAN_MUSIC_PRESETS[mode];
  let noteIndex = 0;
  let stopped = false;

  const playNote = (): void => {
    if (stopped) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = preset.oscillator;
    oscillator.frequency.setValueAtTime(
      preset.frequencies[noteIndex % preset.frequencies.length]!,
      now,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + preset.intervalMs / 1000,
    );
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.intervalMs / 1000 + 0.03);
    noteIndex += 1;
  };

  void context
    .resume()
    .then(playNote)
    .catch(() => undefined);
  const timer = window.setInterval(playNote, preset.intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    void context.close().catch(() => undefined);
  };
};
