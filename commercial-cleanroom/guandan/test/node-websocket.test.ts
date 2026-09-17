import { describe, expect, it } from "vitest";
import { Duplex, PassThrough, type TransformCallback } from "node:stream";
import {
  decodeClientFrame,
  NodeWebSocketConnection,
  websocketAcceptKey,
} from "../src/node-websocket.js";

const maskedTextFrame = (text: string): Buffer => {
  const payload = Buffer.from(text, "utf8");
  if (payload.length >= 126) {
    throw new Error("test helper supports short frames only");
  }

  const mask = Buffer.from([0x37, 0xfa, 0x21, 0x3d]);
  const frame = Buffer.alloc(2 + 4 + payload.length);
  frame[0] = 0x81;
  frame[1] = 0x80 | payload.length;
  mask.copy(frame, 2);
  for (let index = 0; index < payload.length; index += 1) {
    frame[6 + index] = payload[index]! ^ mask[index % 4]!;
  }
  return frame;
};

class BackpressuredSocket extends Duplex {
  readonly writes: Buffer[] = [];
  private readonly callbacks: TransformCallback[] = [];

  constructor() {
    super({ writableHighWaterMark: 1 });
  }

  _read(): void {}

  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.writes.push(Buffer.from(chunk));
    this.callbacks.push(callback);
  }

  releaseWrite(): void {
    this.callbacks.shift()?.();
  }
}

describe("native websocket transport", () => {
  it("computes the RFC 6455 handshake accept key", () => {
    expect(websocketAcceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe(
      "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
    );
  });

  it("decodes a browser-style masked text frame", () => {
    const frame = maskedTextFrame('{"type":"ping","nonce":"abc"}');
    const decoded = decodeClientFrame(frame);

    expect(decoded?.opcode).toBe(0x1);
    expect(decoded?.payload.toString("utf8")).toBe(
      '{"type":"ping","nonce":"abc"}',
    );
    expect(decoded?.consumed).toBe(frame.length);
  });

  it("waits for an incomplete frame instead of corrupting it", () => {
    const frame = maskedTextFrame("hello");
    expect(decodeClientFrame(frame.subarray(0, frame.length - 1))).toBeNull();
  });

  it("rejects unmasked client frames", () => {
    expect(() => decodeClientFrame(Buffer.from([0x81, 0x01, 0x41]))).toThrow(
      "client websocket frames must be masked",
    );
  });

  it("processes messages from one connection in arrival order", async () => {
    const rawSocket = new PassThrough();
    const connection = new NodeWebSocketConnection(rawSocket, {
      roomId: "ordered-room",
    });
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    connection.onText(async (text) => {
      events.push(`start:${text}`);
      if (text === "first") await firstFinished;
      events.push(`end:${text}`);
    });

    connection.feed(
      Buffer.concat([maskedTextFrame("first"), maskedTextFrame("second")]),
    );
    await Promise.resolve();
    expect(events).toEqual(["start:first"]);

    releaseFirst();
    await new Promise((resolve) => setImmediate(resolve));
    expect(events).toEqual([
      "start:first",
      "end:first",
      "start:second",
      "end:second",
    ]);
    rawSocket.destroy();
  });

  it("coalesces snapshots while a slow client applies backpressure", async () => {
    const rawSocket = new BackpressuredSocket();
    const connection = new NodeWebSocketConnection(rawSocket, {
      roomId: "slow-room",
    });

    connection.send(JSON.stringify({ type: "state", revision: 1 }));
    connection.send(JSON.stringify({ type: "state", revision: 2 }));
    connection.send(JSON.stringify({ type: "state", revision: 3 }));
    expect(rawSocket.writes).toHaveLength(1);

    rawSocket.releaseWrite();
    await new Promise((resolve) => setImmediate(resolve));
    expect(rawSocket.writes).toHaveLength(2);
    expect(rawSocket.writes[1]!.toString("utf8")).toContain('"revision":3');
    rawSocket.destroy();
  });
});
