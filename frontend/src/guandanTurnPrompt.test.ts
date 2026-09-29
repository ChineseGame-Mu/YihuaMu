import {
  playGuandanTurnPrompt,
  unlockGuandanTurnPromptAudio,
} from "./guandanTurnPrompt";

describe("Guandan turn prompt", () => {
  const originalAudioContext = window.AudioContext;
  const originalSpeechSynthesis = window.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;

  afterEach(() => {
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: originalAudioContext,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: originalSpeechSynthesis,
    });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: originalUtterance,
    });
    jest.restoreAllMocks();
  });

  test("plays a quiet beep and speaks the Chinese prompt", () => {
    const oscillator = {
      type: "",
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn(),
      },
      connect: jest.fn(),
    };
    const context = {
      state: "running",
      currentTime: 3,
      destination: {},
      createOscillator: jest.fn(() => oscillator),
      createGain: jest.fn(() => gain),
      resume: jest.fn(),
    };
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: jest.fn(() => context),
    });
    const speak = jest.fn();
    const cancel = jest.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak, cancel },
    });
    const utterances: Array<{ text: string; lang?: string }> = [];
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: jest.fn((text: string) => {
        const utterance: { text: string; lang?: string } = { text };
        utterances.push(utterance);
        return utterance;
      }),
    });

    playGuandanTurnPrompt();

    expect(oscillator.start).toHaveBeenCalledWith(3);
    expect(oscillator.stop).toHaveBeenCalledWith(3.15);
    expect(speak).toHaveBeenCalledWith(utterances[0]);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(utterances[0]).toMatchObject({ text: "请出牌", lang: "zh-CN" });
  });

  test("unlocks suspended audio after a player gesture", () => {
    const resume = jest.fn();
    const context = {
      state: "suspended",
      currentTime: 0,
      destination: {},
      createOscillator: jest.fn(),
      createGain: jest.fn(),
      resume,
    };
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: jest.fn(() => context),
    });

    unlockGuandanTurnPromptAudio();

    expect(resume).toHaveBeenCalledTimes(1);
  });
});
