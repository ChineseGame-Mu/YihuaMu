import { spawn } from "node:child_process";

const port = 34000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}/api/guandan`;
const room = `legacy-live-${Date.now()}`;

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

const createMessageQueue = (socket) => {
  const messages = [];
  const waiters = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message));
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      waiter.resolve(message);
      return;
    }
    messages.push(message);
  });

  return (predicate, label) =>
    new Promise((resolve, reject) => {
      const messageIndex = messages.findIndex(predicate);
      if (messageIndex >= 0) {
        const [message] = messages.splice(messageIndex, 1);
        resolve(message);
        return;
      }

      const waiter = {
        predicate,
        resolve: (message) => {
          clearTimeout(timeout);
          resolve(message);
        },
      };
      const timeout = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error(`${label} timeout: ${stderr}`));
      }, 10000);
      waiters.push(waiter);
    });
};

const connect = async (name) => {
  const socket = new WebSocket(wsUrl);
  const waitFor = createMessageQueue(socket);
  const connected = await waitFor(
    ({ type }) => type === "connected",
    `${name} connected`,
  );
  if (connected.protocol !== "yihua-cleanroom-guandan-v1") {
    throw new Error(`unexpected clean-room protocol: ${connected.protocol}`);
  }
  socket.send(JSON.stringify({ type: "join", room, name }));
  const joined = await waitFor(({ type }) => type === "joined", `${name} joined`);
  return { name, socket, waitFor, seat: joined.seat };
};

try {
  await waitForHealth();

  const players = [];
  for (const name of ["玩家1", "玩家2", "玩家3", "玩家4"]) {
    players.push(await connect(name));
  }

  const seats = players.map(({ seat }) => seat);
  if (JSON.stringify(seats) !== JSON.stringify([0, 1, 2, 3])) {
    throw new Error(`unexpected seats: ${JSON.stringify(seats)}`);
  }

  players[0].socket.send(JSON.stringify({ type: "start", player_count: 4 }));

  for (const player of players) {
    const started = await player.waitFor(
      ({ type }) => type === "started",
      `${player.name} started`,
    );
    if (started.player_count !== 4 || started.cards_per_player !== 27) {
      throw new Error(`invalid started message for ${player.name}`);
    }

    const hand = await player.waitFor(
      ({ type }) => type === "hand",
      `${player.name} hand`,
    );
    if (!Array.isArray(hand.cards) || hand.cards.length !== 27) {
      throw new Error(`invalid hand for ${player.name}`);
    }

    const state = await player.waitFor(
      ({ type }) => type === "state",
      `${player.name} state`,
    );
    if (!Array.isArray(state.players) || state.players.length !== 4) {
      throw new Error(`invalid four-player state for ${player.name}`);
    }
  }

  players[0].socket.close();
  await sleep(50);

  const reconnected = await connect("玩家1");
  if (reconnected.seat !== 0) {
    throw new Error(`reconnect allocated wrong seat: ${reconnected.seat}`);
  }

  const reconnectState = await reconnected.waitFor(
    ({ type }) => type === "state",
    "reconnect state",
  );
  if (!Array.isArray(reconnectState.players) || reconnectState.players.length !== 4) {
    throw new Error("reconnect created a duplicate participant");
  }

  for (const player of players.slice(1)) player.socket.close();
  reconnected.socket.close();

  console.log("YIHUA_GAME_LIVE_LEGACY_GUANDAN_GATEWAY_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
}
