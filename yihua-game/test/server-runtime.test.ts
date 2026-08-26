import { describe, expect, it } from "vitest";
import { routeHttp } from "../src/core/http-router.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import {
  attachUpgradedConnection,
  websocketContextFromRequest,
} from "../src/core/websocket-upgrade.js";

describe("independent server runtime", () => {
  it("keeps one persistent room manager behind the http router", () => {
    const runtime = createServerRuntime();

    const created = routeHttp(runtime, {
      method: "POST",
      path: "/api/rooms",
      body: { roomId: "alpha", playerCount: 4 },
    });
    expect(created.status).toBe(201);

    const listed = routeHttp(runtime, {
      method: "GET",
      path: "/api/rooms",
    });
    expect(JSON.parse(listed.body)).toEqual({ rooms: ["alpha"] });

    const room = routeHttp(runtime, {
      method: "GET",
      path: "/api/rooms/alpha",
    });
    expect(room.status).toBe(200);
    expect(JSON.parse(room.body).phase).toBe("lobby");
  });

  it("provides a health route without legacy router dependencies", () => {
    const response = routeHttp(createServerRuntime(), {
      method: "GET",
      path: "/health",
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      ok: true,
      service: "yihua-game",
    });
  });

  it("maps websocket upgrade requests to room contexts", () => {
    expect(
      websocketContextFromRequest({
        path: "/ws/rooms/table-1",
        query: { playerId: "p1" },
      }),
    ).toEqual({ roomId: "table-1", playerId: "p1" });
  });

  it("attaches an upgraded connection to the persistent websocket service", async () => {
    const runtime = createServerRuntime();
    runtime.rooms.create("socket-room", 4);
    const sent: string[] = [];
    let onText: ((text: string) => void | Promise<void>) | undefined;

    await attachUpgradedConnection(runtime, {
      socket: {
        send: (text) => {
          sent.push(text);
        },
      },
      context: { roomId: "socket-room", playerId: "p1" },
      onText: (handler) => {
        onText = handler;
      },
    });

    expect(JSON.parse(sent[0]!).type).toBe("room_state");
    expect(onText).toBeDefined();

    await onText!(JSON.stringify({ type: "ping", nonce: "server" }));
    expect(JSON.parse(sent[1]!)).toEqual({ type: "pong", nonce: "server" });
  });
});
