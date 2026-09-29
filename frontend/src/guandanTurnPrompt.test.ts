import {
  playGuandanTurnPrompt,
  unlockGuandanTurnPromptAudio,
} from "./guandanTurnPrompt";

describe("Guandan turn prompt", () => {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  const originalUtteranceDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "SpeechSynthesisUtterance",
  );

  afterEach(() => {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
    if (originalUtteranceDescriptor) {
      Object.defineProperty(
        globalThis,
        "SpeechSynthesisUtterance",
        originalUtteranceDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
    }
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("unlocks audio and plays a quiet beep before the Chinese prompt", () => {
    jest.useFakeTimers();
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
    const resume = jest.fn(() => {
      context.state = "running";
      return Promise.resolve();
    });
    const context: {
      state: string;
      currentTime: number;
      destination: object;
      createOscillator: jest.Mock;
      createGain: jest.Mock;
      resume: jest.Mock;
    } = {
      state: "suspended",
      currentTime: 3,
      destination: {},
      createOscillator: jest.fn(() => oscillator),
      createGain: jest.fn(() => gain),
      resume,
    };
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { AudioContext: jest.fn(() => context) },
    });
    const speak = jest.fn();
    const cancel = jest.fn();
    Object.assign(window, { speechSynthesis: { speak, cancel } });
    const utterances: Array<{ text: string; lang?: string }> = [];
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: jest.fn((text: string) => {
        const utterance: { text: string; lang?: string } = { text };
        utterances.push(utterance);
        return utterance;
      }),
    });

    unlockGuandanTurnPromptAudio();
    playGuandanTurnPrompt();

    expect(resume).toHaveBeenCalledTimes(1);
    expect(oscillator.start).toHaveBeenCalledWith(3);
    expect(oscillator.stop).toHaveBeenCalledWith(3.15);
    expect(speak).not.toHaveBeenCalled();
    jest.advanceTimersByTime(140);
    expect(speak).toHaveBeenCalledWith(utterances[0]);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(utterances[0]).toMatchObject({ text: "请出牌", lang: "zh-CN" });
  });
});
