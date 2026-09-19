import {
  GUANDAN_MUSIC_PRESETS,
  normalizeGuandanMusicMode,
} from "./guandanMusic";

describe("Guandan optional music", () => {
  test("offers off, relaxing instrumental, and Chinese folk selections", () => {
    expect(normalizeGuandanMusicMode(null)).toBe("off");
    expect(normalizeGuandanMusicMode("relaxing")).toBe("relaxing");
    expect(normalizeGuandanMusicMode("chinese")).toBe("chinese");
    expect(normalizeGuandanMusicMode("unknown")).toBe("off");
    expect(GUANDAN_MUSIC_PRESETS.relaxing.label).toBe("轻松气氛器乐");
    expect(GUANDAN_MUSIC_PRESETS.chinese.label).toBe("中国民乐");
  });

  test("uses distinct low-volume synthesized melodies without external audio", () => {
    expect(GUANDAN_MUSIC_PRESETS.relaxing.frequencies).toHaveLength(8);
    expect(GUANDAN_MUSIC_PRESETS.chinese.frequencies).toHaveLength(8);
    expect(GUANDAN_MUSIC_PRESETS.relaxing.frequencies).not.toEqual(
      GUANDAN_MUSIC_PRESETS.chinese.frequencies,
    );
    expect(GUANDAN_MUSIC_PRESETS.relaxing.oscillator).toBe("sine");
    expect(GUANDAN_MUSIC_PRESETS.chinese.oscillator).toBe("triangle");
  });
});
