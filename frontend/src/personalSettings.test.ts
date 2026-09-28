import {
  getPersonalEmail,
  PERSONAL_SETTINGS_UPDATED_EVENT,
  setPersonalEmail,
} from "./personalSettings";

describe("player personal email settings", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let values: Map<string, string>;
  let dispatchEvent: jest.Mock;

  beforeEach(() => {
    values = new Map();
    dispatchEvent = jest.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
        },
        dispatchEvent,
      },
    });
  });

  afterAll(() => {
    if (originalWindow === undefined)
      delete (globalThis as { window?: Window }).window;
    else Object.defineProperty(globalThis, "window", originalWindow);
  });

  it("loads the email saved for the selected player name", () => {
    values.set("personal_email:alice", "alice@example.com");

    expect(getPersonalEmail(" Alice ")).toBe("alice@example.com");
  });

  it("saves the player-specific email and notifies the active game view", () => {
    setPersonalEmail("Bob", "bob@example.com");

    expect(values.get("personal_email:bob")).toBe("bob@example.com");
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: PERSONAL_SETTINGS_UPDATED_EVENT }),
    );
  });
});
