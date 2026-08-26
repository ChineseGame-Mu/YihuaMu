import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServerRuntime, type ServerRuntime } from "./core/server-runtime.js";
import { routeHttp, type HttpRequest } from "./core/http-router.js";

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
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

export const createNodeHttpServer = (
  runtime: ServerRuntime = createServerRuntime(),
) =>
  createServer(async (request, response) => {
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
