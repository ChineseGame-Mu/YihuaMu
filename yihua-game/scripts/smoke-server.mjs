import { spawn } from "node:child_process";

const port = 33000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/main.js"], {
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForHealth = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server may still be starting.
    }
    await sleep(50);
  }
  throw new Error(`server did not become healthy: ${stderr}`);
};

const waitForMessage = (socket) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("websocket message timeout")),
      3000,
    );
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        resolve(JSON.parse(String(event.data)));
      },
      { once: true },
    );
  });

try {
  await waitForHealth();

  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId: "smoke", playerCount: 4 }),
  });
  if (created.status !== 201) {
    throw new Error(`room creation failed: ${created.status}`);
  }

  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/rooms/smoke`);
  const snapshot = await waitForMessage(socket);
  if (snapshot.type !== "room_state" || snapshot.roomId !== "smoke") {
    throw new Error(`unexpected websocket snapshot: ${JSON.stringify(snapshot)}`);
  }

  socket.send(JSON.stringify({ type: "ping", nonce: "smoke-1" }));
  const pong = await waitForMessage(socket);
  if (pong.type !== "pong" || pong.nonce !== "smoke-1") {
    throw new Error(`unexpected websocket pong: ${JSON.stringify(pong)}`);
  }

  socket.close();
  console.log("YIHUA_GAME_LIVE_HTTP_WEBSOCKET_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
}
