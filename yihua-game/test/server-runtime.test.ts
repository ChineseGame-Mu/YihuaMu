import { describe, expect, it } from "vitest";
import { routeHttp } from "../src/core/http-router.js";
import { createServerRuntime } from "../src/core/server-runtime.js";
import { addHuman, disconnectHuman } from "../src/core/room.js";
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

  it("publishes privacy-safe online counts for cleanroom rooms 0001-0010", () => {
    const runtime = createServerRuntime();
    const stable = runtime.rooms.create("0004", 4);
    runtime.rooms.set("0004", {
      ...stable,
      room: addHuman(stable.room, { id: "stable-id", name: "丙", seat: 0 }),
    });
    const first = runtime.rooms.create("cr-release-0001", 4);
    runtime.rooms.set("cr-release-0001", {
      ...first,
      room: addHuman(first.room, { id: "secret-id", name: "甲", seat: 0 }),
    });
    const tenth = runtime.rooms.create("cr-release-0010", 4);
    const occupiedTenth = addHuman(tenth.room, {
      id: "left-player",
      name: "乙",
      seat: 0,
    });
    runtime.rooms.set("cr-release-0010", {
      ...tenth,
      room: disconnectHuman(occupiedTenth, "left-player"),
    });
    runtime.rooms.create("private-room", 4);

    const response = routeHttp(runtime, {
      method: "GET",
      path: "/api/guandan/rooms",
    });

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(response.body)).toEqual({
      rooms: [
        { roomId: "0004", humanCount: 1, phase: "lobby" },
        { roomId: "cr-release-0001", humanCount: 1, phase: "lobby" },
        { roomId: "cr-release-0010", humanCount: 0, phase: "lobby" },
      ],
    });
    expect(response.body).not.toContain("secret-id");
    expect(response.body).not.toContain("甲");
    expect(response.body).not.toContain("stable-id");
    expect(response.body).not.toContain("private-room");
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
    let onClose: (() => void | Promise<void>) | undefined;

    const socket = {
      send: (text: string) => {
        sent.push(text);
      },
    };

    await attachUpgradedConnection(runtime, {
      socket,
      context: { roomId: "socket-room", playerId: "p1" },
      onText: (handler) => {
        onText = handler;
      },
      onClose: (handler) => {
        onClose = handler;
      },
    });

    expect(JSON.parse(sent[0]!).type).toBe("room_state");
    expect(onText).toBeDefined();
    expect(onClose).toBeDefined();
    expect(runtime.sockets.count("socket-room")).toBe(1);

    await onText!(JSON.stringify({ type: "ping", nonce: "server" }));
    expect(JSON.parse(sent[1]!)).toEqual({ type: "pong", nonce: "server" });

    await onClose!();
    expect(runtime.sockets.count("socket-room")).toBe(0);
  });

  it("broadcasts room changes to every connected client", async () => {
    const runtime = createServerRuntime();
    runtime.rooms.create("broadcast-room", 4);
    const first: string[] = [];
    const second: string[] = [];
    const socket1 = { send: (text: string) => void first.push(text) };
    const socket2 = { send: (text: string) => void second.push(text) };

    runtime.sockets.register("broadcast-room", socket1);
    runtime.sockets.register("broadcast-room", socket2);

    await runtime.websocket.handleText(
      socket1,
      { roomId: "broadcast-room", playerId: "p1" },
      JSON.stringify({
        type: "join_room",
        roomId: "broadcast-room",
        playerId: "p1",
        name: "Player 1",
        seat: 0,
      }),
    );

    expect(JSON.parse(first[0]!).participants).toHaveLength(1);
    expect(JSON.parse(second[0]!).participants).toHaveLength(1);
  });
});
