import type { ServerRuntime } from "./server-runtime.js";
import type { SupportedPlayerCount } from "./table.js";

export interface HttpRequest {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

const json = (status: number, value: unknown): HttpResponse => ({
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(value),
});

const supportedPlayerCounts = new Set([4, 6, 8, 10, 12, 14]);

const isSupportedPlayerCount = (value: unknown): value is SupportedPlayerCount =>
  typeof value === "number" && supportedPlayerCounts.has(value);

export const routeHttp = (
  runtime: ServerRuntime,
  request: HttpRequest,
): HttpResponse => {
  if (request.method === "GET" && request.path === "/health") {
    return json(200, { ok: true, service: "yihua-game" });
  }

  if (request.method === "GET" && request.path === "/api/rooms") {
    return json(200, { rooms: runtime.rooms.listRoomIds() });
  }

  if (request.method === "POST" && request.path === "/api/rooms") {
    const body = request.body as
      | { readonly roomId?: unknown; readonly playerCount?: unknown }
      | undefined;
    if (
      !body ||
      typeof body.roomId !== "string" ||
      !isSupportedPlayerCount(body.playerCount)
    ) {
      return json(400, { error: "invalid room creation request" });
    }

    try {
      const managed = runtime.rooms.create(body.roomId, body.playerCount);
      return json(201, {
        roomId: managed.room.roomId,
        playerCount: managed.room.config.playerCount,
      });
    } catch (error) {
      return json(409, {
        error: error instanceof Error ? error.message : "room creation failed",
      });
    }
  }

  const roomMatch = request.path.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && request.method === "GET") {
    try {
      const managed = runtime.rooms.get(decodeURIComponent(roomMatch[1]!));
      return json(200, {
        room: managed.room,
        phase: managed.game.phase,
      });
    } catch (error) {
      return json(404, {
        error: error instanceof Error ? error.message : "room not found",
      });
    }
  }

  if (roomMatch && request.method === "DELETE") {
    const deleted = runtime.rooms.delete(decodeURIComponent(roomMatch[1]!));
    return deleted
      ? json(200, { deleted: true })
      : json(404, { error: "room not found" });
  }

  return json(404, { error: "route not found" });
};
