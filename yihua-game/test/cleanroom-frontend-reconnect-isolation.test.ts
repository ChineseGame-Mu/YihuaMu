import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const provider = readFileSync(
  new URL("../../frontend/src/GuandanWebsocketProvider.tsx", import.meta.url),
  "utf8",
);

describe("clean-room frontend reconnect isolation", () => {
  it("ignores events from superseded websocket generations", () => {
    expect(provider).toContain("if (websocketRef.current !== ws) return");
    expect(provider).toContain(
      'if (websocketRef.current !== ws || typeof event.data !== "string") return',
    );
  });

  it("clears queued old-socket messages before reconnect snapshots", () => {
    expect(provider).toContain("const clearQueuedMessages = (): void =>");
    expect(provider).toContain("messageQueueRef.current = []");
    expect(provider).toContain(
      'clearQueuedMessages();\n      setStatus("connecting")',
    );
    expect(provider).toContain(
      'websocketRef.current = null;\n        clearQueuedMessages();\n        setStatus("disconnected")',
    );
  });
});
