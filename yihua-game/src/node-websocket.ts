import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";
import type {
  ConnectionContext,
  TextSocket,
} from "./core/websocket-service.js";
import type { UpgradedConnection } from "./core/websocket-upgrade.js";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_PENDING_FRAMES = 64;
const MAX_PENDING_BYTES = 2 * 1024 * 1024;

interface PendingServerFrame {
  readonly frame: Buffer;
  readonly coalesceKey?: string;
}

const coalesceKeyFor = (text: string): string | undefined => {
  try {
    const parsed = JSON.parse(text) as { readonly type?: unknown };
    if (typeof parsed.type !== "string") return undefined;
    return [
      "room_state",
      "game_state",
      "private_hand",
      "waiting",
      "started",
      "state",
      "hand",
    ].includes(parsed.type)
      ? parsed.type
      : undefined;
  } catch {
    return undefined;
  }
};

export const websocketAcceptKey = (clientKey: string): string =>
  createHash("sha1").update(`${clientKey}${WEBSOCKET_GUID}`).digest("base64");

const encodeServerFrame = (opcode: number, payload: Buffer): Buffer => {
  if (payload.length > MAX_FRAME_BYTES) {
    throw new Error("websocket frame is too large");
  }

  if (payload.length < 126) {
    return Buffer.concat([
      Buffer.from([0x80 | opcode, payload.length]),
      payload,
    ]);
  }

  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
};

export interface DecodedClientFrame {
  readonly opcode: number;
  readonly payload: Buffer;
  readonly consumed: number;
}

export const decodeClientFrame = (
  buffer: Buffer,
): DecodedClientFrame | null => {
  if (buffer.length < 2) return null;

  const first = buffer[0]!;
  const second = buffer[1]!;
  const final = (first & 0x80) !== 0;
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let payloadLength = second & 0x7f;
  let offset = 2;

  if (!final) {
    throw new Error("fragmented websocket frames are not supported");
  }
  if (!masked) {
    throw new Error("client websocket frames must be masked");
  }

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) return null;
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) return null;
    const largeLength = buffer.readBigUInt64BE(offset);
    if (largeLength > BigInt(MAX_FRAME_BYTES)) {
      throw new Error("websocket frame is too large");
    }
    payloadLength = Number(largeLength);
    offset += 8;
  }

  if (payloadLength > MAX_FRAME_BYTES) {
    throw new Error("websocket frame is too large");
  }
  if (buffer.length < offset + 4 + payloadLength) return null;

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
  for (let index = 0; index < payload.length; index += 1) {
    payload[index] = payload[index]! ^ mask[index % 4]!;
  }

  return {
    opcode,
    payload,
    consumed: offset + payloadLength,
  };
};

export class NodeWebSocketConnection implements UpgradedConnection, TextSocket {
  readonly socket: TextSocket = this;
  private buffer = Buffer.alloc(0);
  private textHandler: ((text: string) => void | Promise<void>) | undefined;
  private readonly closeHandlers = new Set<() => void | Promise<void>>();
  private textHandling = Promise.resolve();
  private writeBlocked = false;
  private pendingBytes = 0;
  private pendingFrames: PendingServerFrame[] = [];

  constructor(
    private readonly rawSocket: Duplex,
    readonly context: ConnectionContext,
  ) {
    rawSocket.on("drain", () => this.flushPendingFrames());
    rawSocket.once("close", () => {
      this.pendingFrames = [];
      this.pendingBytes = 0;
      for (const handler of this.closeHandlers) {
        void handler();
      }
      this.closeHandlers.clear();
    });
  }

  private canWrite(): boolean {
    return !this.rawSocket.destroyed && !this.rawSocket.writableEnded;
  }

  send(text: string): void {
    if (!this.canWrite()) return;
    const frame = encodeServerFrame(0x1, Buffer.from(text, "utf8"));
    if (!this.writeBlocked) {
      this.writeBlocked = !this.rawSocket.write(frame);
      return;
    }

    const coalesceKey = coalesceKeyFor(text);
    if (coalesceKey !== undefined) {
      const existing = this.pendingFrames.findIndex(
        (pending) => pending.coalesceKey === coalesceKey,
      );
      if (existing !== -1) {
        this.pendingBytes -= this.pendingFrames[existing]!.frame.length;
        this.pendingFrames.splice(existing, 1);
      }
    }

    if (
      this.pendingFrames.length >= MAX_PENDING_FRAMES ||
      this.pendingBytes + frame.length > MAX_PENDING_BYTES
    ) {
      this.pendingFrames = [];
      this.pendingBytes = 0;
      this.close(1013, "client is too slow");
      return;
    }

    this.pendingFrames.push(
      coalesceKey === undefined ? { frame } : { frame, coalesceKey },
    );
    this.pendingBytes += frame.length;
  }

  private flushPendingFrames(): void {
    if (!this.canWrite()) return;
    this.writeBlocked = false;
    while (this.pendingFrames.length > 0) {
      const pending = this.pendingFrames.shift()!;
      this.pendingBytes -= pending.frame.length;
      if (!this.rawSocket.write(pending.frame)) {
        this.writeBlocked = true;
        return;
      }
    }
  }

  close(code = 1000, reason = ""): void {
    if (!this.canWrite()) return;
    const reasonBytes = Buffer.from(reason, "utf8");
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    this.rawSocket.end(encodeServerFrame(0x8, payload));
  }

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
  }

  onClose(handler: () => void | Promise<void>): void {
    this.closeHandlers.add(handler);
  }

  feed(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      while (this.buffer.length > 0) {
        const frame = decodeClientFrame(this.buffer);
        if (!frame) return;
        this.buffer = this.buffer.subarray(frame.consumed);
        this.handleFrame(frame.opcode, frame.payload);
      }
    } catch (error) {
      this.close(
        1002,
        error instanceof Error ? error.message : "websocket protocol error",
      );
    }
  }

  private handleFrame(opcode: number, payload: Buffer): void {
    if (opcode === 0x1) {
      const text = payload.toString("utf8");
      this.textHandling = this.textHandling
        .then(async () => {
          if (this.textHandler) await this.textHandler(text);
        })
        .catch((error: unknown) => {
          this.close(
            1011,
            error instanceof Error ? error.message : "message handler failed",
          );
        });
      return;
    }
    if (opcode === 0x8) {
      if (this.canWrite()) {
        this.rawSocket.end(encodeServerFrame(0x8, payload));
      }
      return;
    }
    if (opcode === 0x9) {
      if (this.canWrite()) {
        this.rawSocket.write(encodeServerFrame(0x0a, payload));
      }
      return;
    }
    if (opcode === 0x0a) return;

    throw new Error(`unsupported websocket opcode: ${opcode}`);
  }
}
