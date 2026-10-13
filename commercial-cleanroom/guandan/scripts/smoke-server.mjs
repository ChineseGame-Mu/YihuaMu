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

const createMessageQueue = (socket) => {
  const messages = [];
  const waiters = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve(message);
    } else {
      messages.push(message);
    }
  });

  return () =>
    new Promise((resolve, reject) => {
      const message = messages.shift();
      if (message) {
        resolve(message);
        return;
      }

      const timeout = setTimeout(() => {
        const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error(`websocket message timeout: ${stderr}`));
      }, 10000);

      waiters.push({
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
      });
    });
};

const participant = (message, playerId) =>
  message.participants?.find(({ id }) => id === playerId);

const createRoom = async (roomId, playerCount) => {
  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, playerCount }),
  });
  if (created.status !== 201) {
    throw new Error(`room creation failed: ${roomId} ${created.status}`);
  }
};

try {
  await waitForHealth();
  await createRoom("smoke", 4);

  const socket1 = new WebSocket(
    `ws://127.0.0.1:${port}/ws/rooms/smoke?playerId=p1`,
  );
  const next1 = createMessageQueue(socket1);
  const socket2 = new WebSocket(
    `ws://127.0.0.1:${port}/ws/rooms/smoke?playerId=p2`,
  );
  const next2 = createMessageQueue(socket2);

  const [snapshot1, snapshot2] = await Promise.all([next1(), next2()]);
  if (snapshot1.type !== "room_state" || snapshot2.type !== "room_state") {
    throw new Error("initial room snapshots were not received");
  }

  socket1.send(
    JSON.stringify({
      type: "join_room",
      roomId: "smoke",
      playerId: "p1",
      name: "玩家1",
      seat: 0,
    }),
  );
  const [joinedOn1, joinedOn2] = await Promise.all([next1(), next2()]);
  if (!participant(joinedOn1, "p1") || !participant(joinedOn2, "p1")) {
    throw new Error("p1 join was not broadcast to both clients");
  }

  socket2.send(
    JSON.stringify({
      type: "join_room",
      roomId: "smoke",
      playerId: "p2",
      name: "玩家2",
      seat: 1,
    }),
  );
  const [secondJoinOn1, secondJoinOn2] = await Promise.all([next1(), next2()]);
  if (!participant(secondJoinOn1, "p2") || !participant(secondJoinOn2, "p2")) {
    throw new Error("p2 join was not broadcast to both clients");
  }

  socket1.close();
  const disconnected = await next2();
  if (participant(disconnected, "p1")?.connected !== false) {
    throw new Error("p1 disconnect was not broadcast");
  }

  const socket1Reconnect = new WebSocket(
    `ws://127.0.0.1:${port}/ws/rooms/smoke?playerId=p1`,
  );
  const next1Reconnect = createMessageQueue(socket1Reconnect);
  const [reconnectedOn1, reconnectedOn2] = await Promise.all([
    next1Reconnect(),
    next2(),
  ]);
  if (
    participant(reconnectedOn1, "p1")?.connected !== true ||
    participant(reconnectedOn2, "p1")?.connected !== true
  ) {
    throw new Error("p1 reconnect was not synchronized");
  }

  socket2.send(JSON.stringify({ type: "ping", nonce: "smoke-1" }));
  const pong = await next2();
  if (pong.type !== "pong" || pong.nonce !== "smoke-1") {
    throw new Error(`unexpected websocket pong: ${JSON.stringify(pong)}`);
  }

  socket1Reconnect.close();
  socket2.close();

  await createRoom("game", 4);
  const clients = Array.from({ length: 4 }, (_, index) => {
    const playerId = `g${index + 1}`;
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/ws/rooms/game?playerId=${playerId}`,
    );
    return {
      playerId,
      seat: index,
      socket,
      next: createMessageQueue(socket),
    };
  });

  const initialSnapshots = await Promise.all(clients.map(({ next }) => next()));
  if (initialSnapshots.some(({ type }) => type !== "room_state")) {
    throw new Error("four-player initial snapshots failed");
  }

  for (const client of clients) {
    client.socket.send(
      JSON.stringify({
        type: "join_room",
        roomId: "game",
        playerId: client.playerId,
        name: `玩家${client.seat + 1}`,
        seat: client.seat,
      }),
    );
    const updates = await Promise.all(clients.map(({ next }) => next()));
    if (
      updates.some(
        (message) => !participant(message, client.playerId)?.connected,
      )
    ) {
      throw new Error(`join broadcast failed for ${client.playerId}`);
    }
  }

  clients[0].socket.send(JSON.stringify({ type: "start_game" }));
  const roomStates = await Promise.all(clients.map(({ next }) => next()));
  if (roomStates.some(({ type }) => type !== "room_state")) {
    throw new Error("start_game room state broadcast failed");
  }

  const gameStates = await Promise.all(clients.map(({ next }) => next()));
  const firstGameState = gameStates[0];
  if (
    gameStates.some(({ type }) => type !== "game_state") ||
    firstGameState.openingDraw.length !== 4 ||
    firstGameState.openingDrawWinner < 0 ||
    firstGameState.openingDrawWinner >= 4 ||
    firstGameState.currentTurn !== firstGameState.openingDrawWinner ||
    firstGameState.handCounts.some((count) => count !== 27)
  ) {
    throw new Error(
      `invalid public game state: ${JSON.stringify(firstGameState)}`,
    );
  }

  for (const gameState of gameStates.slice(1)) {
    if (
      JSON.stringify(gameState.openingDraw) !==
        JSON.stringify(firstGameState.openingDraw) ||
      gameState.openingDrawWinner !== firstGameState.openingDrawWinner ||
      gameState.currentTurn !== firstGameState.currentTurn
    ) {
      throw new Error("public game state differed between clients");
    }
  }

  const privateHands = await Promise.all(clients.map(({ next }) => next()));
  privateHands.forEach((message, index) => {
    if (
      message.type !== "private_hand" ||
      message.seat !== index ||
      message.cards.length !== 27 ||
      new Set(message.cards.map(({ id }) => id)).size !== 27
    ) {
      throw new Error(`invalid private hand for seat ${index}`);
    }
  });

  clients.forEach(({ socket }) => socket.close());
  console.log("YIHUA_GAME_FOUR_PLAYER_NETWORK_START_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
}
