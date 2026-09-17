import {
  shouldHideReturnTributeFace,
  tributeGivers,
  tributeReceivers,
} from "./guandanReturnTributePrivacy";

const single = { Single: { giver: 3, receiver: 0 } } as const;
const double = {
  Double: {
    givers: [2, 3] as [number, number],
    receivers: [0, 1] as [number, number],
  },
} as const;

describe("Guandan return tribute privacy", () => {
  test("keeps ordinary tribute cards face-up", () => {
    expect(shouldHideReturnTributeFace(true, single, 0, 3)).toBe(false);
  });

  test("hides a return card from winner and observers but not losing side", () => {
    expect(shouldHideReturnTributeFace(true, single, 0, 0)).toBe(true);
    expect(shouldHideReturnTributeFace(true, single, null, 0)).toBe(true);
    expect(shouldHideReturnTributeFace(true, single, 3, 0)).toBe(false);
  });

  test("recognizes both sides of a double tribute", () => {
    expect(tributeGivers(double)).toEqual([2, 3]);
    expect(tributeReceivers(double)).toEqual([0, 1]);
    expect(shouldHideReturnTributeFace(true, double, 0, 1)).toBe(true);
    expect(shouldHideReturnTributeFace(true, double, 2, 1)).toBe(false);
  });

  test("leaves the table unchanged when the option is off", () => {
    expect(shouldHideReturnTributeFace(false, single, 0, 0)).toBe(false);
  });
});
