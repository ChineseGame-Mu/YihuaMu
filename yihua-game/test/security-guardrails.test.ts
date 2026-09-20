import { afterEach, describe, expect, it } from "vitest";
import { request } from "node:http";
import { PassThrough } from "node:stream";
import { parseClientMessage } from "../src/core/protocol.js";
import { createNodeHttpServer } from "../src/node-server.js";
import { NodeWebSocketConnection } from "../src/node-websocket.js";

const servers: ReturnType<typeof createNodeHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

const listen = async (): Promise<number> => {
  const server = createNodeHttpServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server did not expose a TCP port");
  }
  return address.port;
};

const httpRequest = async (
  port: number,
  options: {
    readonly method: string;
    readonly path: string;
    readonly body?: string;
  },
) =>
  new Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  }>((resolve, reject) => {
    const body = options.body ?? "";
    const outbound = request(
      {
        host: "127.0.0.1",
        port,
        method: options.method,
        path: options.path,
        headers:
          body.length > 0
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              }
            : undefined,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outbound.on("error", reject);
    outbound.end(body);
  });

describe("network security guardrails", () => {
  it("adds browser hardening headers to every HTTP response", async () => {
    const response = await httpRequest(await listen(), {
      method: "GET",
      path: "/health",
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["permissions-policy"]).toContain("camera=()");
  });

  it("rejects oversized JSON request bodies before parsing", async () => {
    const response = await httpRequest(await listen(), {
      method: "POST",
      path: "/api/rooms",
      body: JSON.stringify({ padding: "x".repeat(65_536) }),
    });

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({
      error: "request body is too large",
    });
  });

  it("does not expose unauthenticated room deletion", async () => {
    const response = await httpRequest(await listen(), {
      method: "DELETE",
      path: "/api/rooms/0001",
    });

    expect(response.status).toBe(405);
  });

  it("bounds websocket input buffering", () => {
    const rawSocket = new PassThrough();
    const connection = new NodeWebSocketConnection(rawSocket, {
      roomId: "security-room",
    });

    connection.feed(Buffer.alloc(2 * 1024 * 1024 + 1));

    const closeFrame = rawSocket.read() as Buffer | null;
    expect(closeFrame).not.toBeNull();
    expect(closeFrame?.toString("utf8")).toContain(
      "websocket input buffer is too large",
    );
  });
});

describe("protocol input limits", () => {
  it("accepts supported lobby values", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "join_room",
          roomId: "0001",
          playerId: "p1",
          name: "玩家一",
          seat: 13,
        }),
      ),
    ).toMatchObject({ roomId: "0001", playerId: "p1", seat: 13 });
    expect(parseClientMessage('{"type":"set_robots","count":3}')).toEqual({
      type: "set_robots",
      count: 3,
    });
  });

  it("rejects oversized or out-of-range client fields", () => {
    expect(() =>
      parseClientMessage(
        JSON.stringify({
          type: "join_room",
          roomId: "r".repeat(65),
          playerId: "p1",
          name: "player",
          seat: 0,
        }),
      ),
    ).toThrow(/roomId/);
    expect(() => parseClientMessage('{"type":"set_robots","count":4}')).toThrow(
      /set_robots/,
    );
    expect(() =>
      parseClientMessage(
        JSON.stringify({
          type: "play_cards",
          cardIds: Array.from({ length: 65 }, (_, index) => `card-${index}`),
        }),
      ),
    ).toThrow(/cardIds/);
    expect(() =>
      parseClientMessage(
        JSON.stringify({ type: "ping", nonce: "n".repeat(257) }),
      ),
    ).toThrow(/ping/);
  });
});
