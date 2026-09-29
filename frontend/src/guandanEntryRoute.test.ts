import {
  guandanEntryHref,
  shouldRenderDedicatedGuandanEntry,
} from "./guandanEntryRoute";

describe("Guandan homepage entry route", () => {
  it("opens the dedicated lobby on the original Guandan hostname", () => {
    expect(guandanEntryHref()).toBe("https://yihua-mu.vercel.app/");
  });

  it("uses the dedicated lobby at the old site's root, but keeps classic mode selectable", () => {
    expect(shouldRenderDedicatedGuandanEntry("yihua-mu.vercel.app", "")).toBe(
      true,
    );
    expect(
      shouldRenderDedicatedGuandanEntry("yihua-mu.vercel.app", "?classic=1"),
    ).toBe(false);
    expect(shouldRenderDedicatedGuandanEntry("other.example", "")).toBe(false);
    expect(
      shouldRenderDedicatedGuandanEntry("other.example", "?cleanroom=1"),
    ).toBe(true);
  });

  it(
    "keeps explicit Guandan room links on the table when cleanroom is present",
    () => {
      expect(
        shouldRenderDedicatedGuandanEntry(
          "yihua-mu.vercel.app",
          "?cleanroom=1&game=guandan&room=0004",
        ),
      ).toBe(false);
      expect(
        shouldRenderDedicatedGuandanEntry(
          "preview.example",
          "?cleanroom=1&game=guandan&room=0004",
        ),
      ).toBe(false);
    },
  );
});
