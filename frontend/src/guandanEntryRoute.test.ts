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
});
