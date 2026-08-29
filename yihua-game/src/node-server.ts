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

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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
  response.writeHead(status, headers);
  response.end(body);
};

const headerValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

const publicWebsocketUrl = (request: IncomingMessage): string => {
  const host = headerValue(request.headers.host);
  if (host === undefined || host.trim() === "") {
    throw new Error("host header is required");
  }
  const forwarded = headerValue(request.headers["x-forwarded-proto"])
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  return `${forwarded === "https" ? "wss:" : "ws:"}//${host}/api/guandan`;
};

const approvedTableUrl = (
  request: IncomingMessage,
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
  target.searchParams.set("game", "guandan");
  target.searchParams.set("players", String(managed.room.config.playerCount));
  target.searchParams.set("room", roomId);
  target.searchParams.set("name", participant.name);
  target.searchParams.set("ws", publicWebsocketUrl(request));
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
      if (method !== "GET" && method !== "POST" && method !== "DELETE") {
        writeResponse(
          response,
          405,
          { "content-type": "application/json; charset=utf-8" },
          JSON.stringify({ error: "method not allowed" }),
        );
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");
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
              location: approvedTableUrl(request, runtime, roomId, playerId),
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
      writeResponse(
        response,
        400,
        { "content-type": "application/json; charset=utf-8" },
        JSON.stringify({
          error: error instanceof Error ? error.message : "invalid request",
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
          !clientKey
        ) {
          rejectUpgrade(socket, "invalid websocket upgrade");
          return;
        }

        const url = new URL(request.url ?? "/", "http://localhost");
        const isLegacyGuandan = url.pathname === "/api/guandan";
        const query = Object.fromEntries(url.searchParams.entries());
        const context = isLegacyGuandan
          ? { roomId: "__legacy_guandan_pending__" }
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

  return server;
};
