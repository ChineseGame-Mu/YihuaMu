import { createGuandanVictoryScreenshot } from "./guandanVictoryScreenshot";

describe("Guandan victory screenshot", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { document?: Document }).document;
    delete (globalThis as { Image?: typeof Image }).Image;
  });

  it("renders the victory image to a PNG and returns its base64 payload", async () => {
    const drawImage = jest.fn();
    const toDataURL = jest.fn(() => "data:image/png;base64,c2NyZWVuc2hvdA==");
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => ({ drawImage })),
      toDataURL,
    } as unknown as HTMLCanvasElement;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: jest.fn(() => canvas) },
    });

    const image = {
      onload: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      set src(_url: string) {
        this.onload?.(new Event("load"));
      },
    } as unknown as HTMLImageElement;
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: jest.fn(() => image),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:guandan-victory"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });

    await expect(
      createGuandanVictoryScreenshot({
        winnerTeam: "TeamA",
        players: ["Alice", "Bob", "Carol", "Dave"],
        finishOrder: [0, 2, 1, 3],
        room: "0001",
      }),
    ).resolves.toBe("c2NyZWVuc2hvdA==");

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1000);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1600, 1000);
    expect(toDataURL).toHaveBeenCalledWith("image/png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:guandan-victory");
  });

  it("rejects when the browser cannot create a 2D canvas context", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => null),
    } as unknown as HTMLCanvasElement;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: jest.fn(() => canvas) },
    });

    const image = {
      onload: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      set src(_url: string) {
        this.onload?.(new Event("load"));
      },
    } as unknown as HTMLImageElement;
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      value: jest.fn(() => image),
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:guandan-victory"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });

    await expect(
      createGuandanVictoryScreenshot({
        winnerTeam: "TeamB",
        players: ["Alice", "Bob", "Carol", "Dave"],
        finishOrder: [1, 3, 0, 2],
        room: "0001",
      }),
    ).rejects.toThrow("浏览器无法创建截图");
  });
});
