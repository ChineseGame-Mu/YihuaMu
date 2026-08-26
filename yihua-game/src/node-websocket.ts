import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import type { ConnectionContext, TextSocket } from "./core/websocket-service.js";
import type { UpgradedConnection } from "./core/websocket-upgrade.js";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_FRAME_BYTES = 1024 * 1024;

export const websocketAcceptKey = (clientKey: string): string =>
  createHash("sha1")
    .update(`${clientKey}${WEBSOCKET_GUID}`)
    .digest("base64");

const encodeServerFrame = (opcode: number, payload: Buffer): Buffer => {
  if (payload.length > MAX_FRAME_BYTES) {
    throw new Error("websocket frame is too large");
  }

  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x80 | opcode, payload.length]), payload]);
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

export class NodeWebSocketConnection
  implements UpgradedConnection, TextSocket
{
  private buffer = Buffer.alloc(0);
  private textHandler: ((text: string) => void | Promise<void>) | undefined;

  constructor(
    private readonly rawSocket: Socket,
    readonly context: ConnectionContext,
  ) {}

  send(text: string): void {
    this.rawSocket.write(encodeServerFrame(0x1, Buffer.from(text, "utf8")));
  }

  close(code = 1000, reason = ""): void {
    const reasonBytes = Buffer.from(reason, "utf8");
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    this.rawSocket.end(encodeServerFrame(0x8, payload));
  }

  onText(handler: (text: string) => void | Promise<void>): void {
    this.textHandler = handler;
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
      if (this.textHandler) {
        void this.textHandler(payload.toString("utf8"));
      }
      return;
    }
    if (opcode === 0x8) {
      this.rawSocket.end(encodeServerFrame(0x8, payload));
      return;
    }
    if (opcode === 0x9) {
      this.rawSocket.write(encodeServerFrame(0x0a, payload));
      return;
    }
    if (opcode === 0x0a) return;

    throw new Error(`unsupported websocket opcode: ${opcode}`);
  }
}
