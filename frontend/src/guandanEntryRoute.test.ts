import { guandanEntryHref } from "./guandanEntryRoute";

describe("Guandan homepage entry route", () => {
  it("keeps the current deployment host and opens the Guandan view", () => {
    expect(
      guandanEntryHref("https://yihua-mu.vercel.app/?lang=zh#home"),
    ).toBe("https://yihua-mu.vercel.app/guandan");
  });
});
