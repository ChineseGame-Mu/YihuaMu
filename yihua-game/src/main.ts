import { createNodeHttpServer } from "./node-server.js";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT must be an integer from 1 through 65535");
}

const server = createNodeHttpServer();
server.listen(port, host, () => {
  console.log(`Yihua Game listening on http://${host}:${port}`);
});
