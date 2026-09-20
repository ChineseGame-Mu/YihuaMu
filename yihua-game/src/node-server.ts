import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { renderJoinPage } from "./core/join-page.js";
import { attachLegacyGuandanConnection } from "./core/legacy-guandan-gateway.js";
import {
  createServerRuntime,
  type ServerRuntime,
} from "./core/server-runtime.js";
import { routeHttp, type HttpRequest } from "./core/http-router.js";
import {
  attachUpgradedConnection,
  websocketContextFromRequest,
} from "./core/websocket-upgrade.js";
import {
  NodeWebSocketConnection,
  websocketAcceptKey,
} from "./node-websocket.js";

const APPROVED_GUANDAN_FRONTEND =
  "https://yihua-mu-git-optimize-guandan-online-perfor-de2a6d-chinese-game.vercel.app/";
const CLEANROOM_GUANDAN_WEBSOCKET =
  "wss://card-games-yihua.onrender.com/api/guandan";
const LEGACY_PENDING_ROOM = "__legacy_guandan_pending__";
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_REQUEST_TARGET_BYTES = 4 * 1024;

const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
} as const;

class RequestLimitError extends Error {
  readonly status = 413;
}

const cleanroomGuandanWebsocket = (roomId: string): string => {
  const target = new URL(CLEANROOM_GUANDAN_WEBSOCKET);
  target.searchParams.set("cleanroomRoom", roomId);
  return target.toString();
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new RequestLimitError("request body is too large");
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;
    if (receivedBytes > MAX_JSON_BODY_BYTES) {
      throw new RequestLimitError("request body is too large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const writeResponse = (
  response: ServerResponse,
  status: number,
  headers: Readonly<Record<string, string>>,
  body: string,
): void => {
  response.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  response.end(body);
};

const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

const validWebSocketKey = (value: string | undefined): value is string => {
  if (!value || value.length > 64) return false;
  try {
    return Buffer.from(value, "base64").length === 16;
  } catch {
    return false;
  }
};

const approvedTableUrl = (
  runtime: ServerRuntime,
  roomId: string,
  playerId: string,
): string => {
  const managed = runtime.rooms.get(roomId);
  const participant = managed.room.participants.find(
    ({ id, kind }) => id === playerId && kind === "human",
  );
  if (participant === undefined) {
    throw new Error("player must join the room before opening the table");
  }

  const target = new URL(APPROVED_GUANDAN_FRONTEND);
  target.searchParams.set("test", "1");
  target.searchParams.set("cleanroom", "1");
  target.searchParams.set("game", "guandan");
  target.searchParams.set("players", String(managed.room.config.playerCount));
  target.searchParams.set("cleanroomRoom", roomId);
  target.searchParams.set("room", "0001");
  target.searchParams.set("name", participant.name);
  target.searchParams.set("ws", cleanroomGuandanWebsocket(roomId));
  return target.toString();
};

const rejectUpgrade = (
  socket: NodeJS.WritableStream,
  message: string,
): void => {
  socket.write(
    "HTTP/1.1 400 Bad Request\r\n" +
      "Connection: close\r\n" +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n` +
      message,
  );
  if ("end" in socket && typeof socket.end === "function") socket.end();
};

export const createNodeHttpServer = (
  runtime: ServerRuntime = createServerRuntime(),
) => {
  const server = createServer(async (request, response) => {
    try {
      const method = request.method;
      if (method !== "GET" && method !== "POST") {
        writeResponse(
          response,
          405,
          { "content-type": "application/json; charset=utf-8" },
          JSON.stringify({ error: "method not allowed" }),
        );
        return;
      }

      const requestTarget = request.url ?? "/";
      if (Buffer.byteLength(requestTarget) > MAX_REQUEST_TARGET_BYTES) {
        throw new RequestLimitError("request target is too large");
      }
      const url = new URL(requestTarget, "http://localhost");
      if (method === "GET") {
        const tablePage = url.pathname.match(/^\/room\/([^/]+)\/table$/);
        if (tablePage) {
          const roomId = decodeURIComponent(tablePage[1]!);
          const playerId = url.searchParams.get("playerId")?.trim();
          if (playerId === undefined || playerId === "") {
            throw new Error("playerId is required");
          }
          writeResponse(
            response,
            302,
            {
              location: approvedTableUrl(runtime, roomId, playerId),
              "cache-control": "no-store",
            },
            "",
          );
          return;
        }

        const joinPage = url.pathname.match(/^\/room\/([^/]+)$/);
        if (joinPage) {
          const roomId = decodeURIComponent(joinPage[1]!);
          if (roomId.trim().length === 0)
            throw new Error("room id is required");
          writeResponse(
            response,
            200,
            { "content-type": "text/html; charset=utf-8" },
            renderJoinPage(roomId),
          );
          return;
        }
      }

      const body = method === "POST" ? await readJsonBody(request) : undefined;
      const routedRequest: HttpRequest =
        body === undefined
          ? { method, path: url.pathname }
          : { method, path: url.pathname, body };
      const result = routeHttp(runtime, routedRequest);
      writeResponse(response, result.status, result.headers, result.body);
    } catch (error) {
      const status = error instanceof RequestLimitError ? error.status : 400;
      writeResponse(
        response,
        status,
        { "content-type": "application/json; charset=utf-8" },
        JSON.stringify({
          error:
            error instanceof RequestLimitError
              ? error.message
              : "invalid request",
        }),
      );
    }
  });

  server.on("upgrade", (request, socket, head) => {
    socket.pause();
    void (async () => {
      try {
        const upgrade = headerValue(request.headers.upgrade)?.toLowerCase();
        const connection = headerValue(
          request.headers.connection,
        )?.toLowerCase();
        const version = headerValue(request.headers["sec-websocket-version"]);
        const clientKey = headerValue(request.headers["sec-websocket-key"]);

        if (
          upgrade !== "websocket" ||
          !connection?.split(",").some((token) => token.trim() === "upgrade") ||
          version !== "13" ||
          !validWebSocketKey(clientKey)
        ) {
          rejectUpgrade(socket, "invalid websocket upgrade");
          return;
        }

        const requestTarget = request.url ?? "/";
        if (Buffer.byteLength(requestTarget) > MAX_REQUEST_TARGET_BYTES) {
          rejectUpgrade(socket, "websocket request target is too large");
          return;
        }
        const url = new URL(requestTarget, "http://localhost");
        const isLegacyGuandan = url.pathname === "/api/guandan";
        const query = Object.fromEntries(url.searchParams.entries());
        const cleanroomRoom = query.cleanroomRoom?.trim();
        const context = isLegacyGuandan
          ? {
              roomId:
                cleanroomRoom === undefined || cleanroomRoom === ""
                  ? LEGACY_PENDING_ROOM
                  : cleanroomRoom,
            }
          : websocketContextFromRequest({ path: url.pathname, query });

        if (!isLegacyGuandan) runtime.rooms.get(context.roomId);

        socket.write(
          "HTTP/1.1 101 Switching Protocols\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            `Sec-WebSocket-Accept: ${websocketAcceptKey(clientKey)}\r\n\r\n`,
        );

        const upgraded = new NodeWebSocketConnection(socket, context);
        if (isLegacyGuandan)
          await attachLegacyGuandanConnection(runtime, upgraded);
        else await attachUpgradedConnection(runtime, upgraded);
        socket.on("data", (chunk: Buffer) => upgraded.feed(chunk));
        if (head.length > 0) upgraded.feed(head);
        socket.resume();
      } catch (error) {
        rejectUpgrade(
          socket,
          error instanceof Error ? error.message : "websocket upgrade failed",
        );
      }
    })();
  });

  server.maxHeadersCount = 100;
  server.headersTimeout = 15_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  return server;
};
