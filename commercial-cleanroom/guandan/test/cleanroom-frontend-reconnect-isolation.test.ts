import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const provider = readFileSync(
  new URL("../../frontend/src/GuandanWebsocketProvider.tsx", import.meta.url),
  "utf8",
);
describe("clean-room frontend reconnect isolation", () => {
  it("ignores events from superseded websocket generations", () => {
    expect(provider).toContain("if (websocketRef.current !== ws) return");
    expect(provider).toContain("generationRef.current !== generation");
    expect(provider).toContain('typeof event.data !== "string"');
  });
  it("clears queued old-socket messages before reconnect snapshots", () => {
    expect(provider).toContain("const clearQueuedMessages = (): void =>");
    expect(provider).toContain("messageQueueRef.current = []");
    expect(provider).toContain(
      'clearQueuedMessages(); setStatus("connecting")',
    );
    expect(provider).toContain(
      'websocketRef.current = null; clearQueuedMessages(); setStatus("disconnected")',
    );
  });
  it("uses bounded exponential reconnect backoff", () => {
    expect(provider).toContain(
      "Math.min(1000 * 2 ** reconnectAttemptRef.current, 10000)",
    );
    expect(provider).toContain("reconnectAttemptRef.current += 1");
    expect(provider).toContain("window.setTimeout(connect, delay)");
  });
});
