jest.mock("html2canvas", () => ({ __esModule: true, default: jest.fn() }));

import html2canvas from "html2canvas";
import { createGuandanVictoryScreenshot } from "./guandanVictoryScreenshot";

const capture = html2canvas as jest.Mock;

describe("Guandan victory screenshot capture", () => {
  afterEach(() => {
    jest.resetAllMocks();
    delete (globalThis as { document?: Document }).document;
    delete (globalThis as { window?: Window }).window;
  });

  it("captures the rendered fullscreen victory layer as PNG bytes", async () => {
    const target = {} as HTMLElement;
    const canvas = {
      toDataURL: jest.fn(() => "data:image/png;base64,c2NyZWVuc2hvdA=="),
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: jest.fn(() => target) },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { devicePixelRatio: 3 },
    });
    capture.mockResolvedValue(canvas);

    await expect(createGuandanVictoryScreenshot()).resolves.toBe(
      "c2NyZWVuc2hvdA==",
    );
    expect(document.querySelector).toHaveBeenCalledWith(
      "[data-victory-capture='true']",
    );
    expect(capture).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ scale: 2 }),
    );
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/png");
  });

  it("fails when the fullscreen victory layer is not mounted", async () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { querySelector: jest.fn(() => null) },
    });
    await expect(createGuandanVictoryScreenshot()).rejects.toThrow(
      "胜利画面尚未显示",
    );
    expect(capture).not.toHaveBeenCalled();
  });
});
