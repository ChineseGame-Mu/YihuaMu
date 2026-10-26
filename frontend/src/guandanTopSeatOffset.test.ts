import {
  calculateGuandanTopSeatOffset,
  type GuandanPanelBounds,
  GUANDAN_TOP_SEAT_NOTICE_SELECTORS,
} from "./guandanTopSeatOffset";

const zone = { top: 100, bottom: 600 };
const panel = (
  top: number,
  bottom: number,
  overrides: Partial<GuandanPanelBounds> = {},
): GuandanPanelBounds => ({
  top,
  bottom,
  width: 300,
  height: bottom - top,
  display: "block",
  visibility: "visible",
  ...overrides,
});

describe("top seat dynamically clears visible public-table notices", () => {
  test("permanent table title never displaces the resting seat", () => {
    const selectors = GUANDAN_TOP_SEAT_NOTICE_SELECTORS;
    expect(selectors.join(",")).not.toContain(".guandan-zone-title");
    expect(selectors).toContain(".guandan-tribute-panel");
  });

  test("rests at the public-table edge when no notice is visible", () => {
    expect(calculateGuandanTopSeatOffset(zone, [])).toBe(0);
  });

  test("moves to the bottom of the visible notice", () => {
    expect(calculateGuandanTopSeatOffset(zone, [panel(110, 235.5)])).toBe(136);
  });

  test("clears the lowest of overlapping start, tribute and next-round panels", () => {
    expect(
      calculateGuandanTopSeatOffset(zone, [
        panel(120, 170),
        panel(125, 280),
        panel(150, 210),
      ]),
    ).toBe(180);
  });

  test("ignores hidden, zero-size and out-of-zone panels", () => {
    expect(
      calculateGuandanTopSeatOffset(zone, [
        panel(100, 300, { display: "none" }),
        panel(100, 400, { visibility: "hidden" }),
        panel(100, 500, { width: 0 }),
        panel(100, 550, { height: 0 }),
        panel(0, 100),
        panel(600, 650),
      ]),
    ).toBe(0);
  });

  test("returns to table edge after a notice disappears", () => {
    expect(calculateGuandanTopSeatOffset(zone, [panel(110, 260)])).toBe(160);
    expect(
      calculateGuandanTopSeatOffset(zone, [
        panel(110, 260, { display: "none" }),
      ]),
    ).toBe(0);
  });
});
