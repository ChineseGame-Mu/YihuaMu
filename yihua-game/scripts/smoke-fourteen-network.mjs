import { spawn } from "node:child_process";

const port = 35000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomId = `fourteen-network-${Date.now()}`;
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
    if (waiter) waiter.resolve(message);
    else messages.push(message);
  });

  return () =>
    new Promise((resolve, reject) => {
      const message = messages.shift();
      if (message) {
        resolve(message);
        return;
      }

      const timeout = setTimeout(() => {
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

const nextBatch = (clients) => Promise.all(clients.map(({ next }) => next()));

const waitForOpen = (socket) =>
  new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

try {
  await waitForHealth();
  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, playerCount: 14 }),
  });
  if (created.status !== 201) {
    throw new Error(`14-player room creation failed: ${created.status}`);
  }

  const clients = Array.from({ length: 14 }, (_, seat) => {
    const playerId = `p${seat + 1}`;
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/ws/rooms/${encodeURIComponent(roomId)}?playerId=${playerId}`,
    );
    return {
      playerId,
      seat,
      socket,
      next: createMessageQueue(socket),
    };
  });

  await Promise.all(clients.map(({ socket }) => waitForOpen(socket)));
  const initial = await nextBatch(clients);
  if (initial.some(({ type }) => type !== "room_state")) {
    throw new Error("14-client initial snapshots failed");
  }

  for (const client of clients) {
    client.socket.send(
      JSON.stringify({
        type: "join_room",
        roomId,
        playerId: client.playerId,
        name: client.seat < 2 ? "同名玩家" : `玩家${client.seat + 1}`,
        seat: client.seat,
      }),
    );
    const updates = await nextBatch(clients);
    if (updates.some(({ type }) => type !== "room_state")) {
      throw new Error(`14-client join broadcast failed for seat ${client.seat}`);
    }
    const expectedParticipants = client.seat + 1;
    if (
      updates.some(
        ({ participants }) => participants.length !== expectedParticipants,
      )
    ) {
      throw new Error(
        `room state diverged after seat ${client.seat}: expected ${expectedParticipants} participants`,
      );
    }
  }

  const finalRoomResponse = await fetch(`${baseUrl}/api/rooms/${roomId}`);
  const finalRoom = await finalRoomResponse.json();
  const participants = finalRoom.room?.participants ?? [];
  if (
    finalRoom.room?.config?.playerCount !== 14 ||
    participants.length !== 14 ||
    new Set(participants.map(({ id }) => id)).size !== 14 ||
    new Set(participants.map(({ seat }) => seat)).size !== 14
  ) {
    throw new Error(`14-client final room mismatch: ${JSON.stringify(finalRoom)}`);
  }

  const fifteenth = {
    playerId: "p15",
    socket: new WebSocket(
      `ws://127.0.0.1:${port}/ws/rooms/${encodeURIComponent(roomId)}?playerId=p15`,
    ),
  };
  fifteenth.next = createMessageQueue(fifteenth.socket);
  await waitForOpen(fifteenth.socket);
  const fifteenthInitial = await fifteenth.next();
  if (fifteenthInitial.type !== "room_state") {
    throw new Error("15th client did not receive a room snapshot");
  }
  fifteenth.socket.send(
    JSON.stringify({
      type: "join_room",
      roomId,
      playerId: "p15",
      name: "玩家15",
      seat: 14,
    }),
  );
  const rejection = await fifteenth.next();
  if (
    rejection.type !== "error" ||
    !String(rejection.message).includes("14-player maximum")
  ) {
    throw new Error(`15th client was not rejected: ${JSON.stringify(rejection)}`);
  }
  fifteenth.socket.close();

  clients[0].socket.send(JSON.stringify({ type: "start_game" }));
  const startRoomStates = await nextBatch(clients);
  const startGameStates = await nextBatch(clients);
  const privateHands = await nextBatch(clients);
  if (
    startRoomStates.some(({ type }) => type !== "room_state") ||
    startGameStates.some(
      ({ type, handCounts }) =>
        type !== "game_state" ||
        handCounts.length !== 14 ||
        handCounts.some((count) => count !== 27),
    ) ||
    privateHands.some(
      ({ type, cards }) => type !== "private_hand" || cards.length !== 27,
    )
  ) {
    throw new Error("14-client start-game synchronization failed");
  }

  const reconnectTarget = clients[6];
  reconnectTarget.socket.close();
  const disconnectedStates = await Promise.all(
    clients
      .filter((client) => client !== reconnectTarget)
      .map(({ next }) => next()),
  );
  if (
    disconnectedStates.some(
      ({ type, participants: stateParticipants }) =>
        type !== "room_state" ||
        stateParticipants.find(({ id }) => id === reconnectTarget.playerId)
          ?.connected !== false,
    )
  ) {
    throw new Error("disconnect state did not synchronize to remaining clients");
  }

  const reconnectSocket = new WebSocket(
    `ws://127.0.0.1:${port}/ws/rooms/${encodeURIComponent(roomId)}?playerId=${reconnectTarget.playerId}`,
  );
  const reconnectNext = createMessageQueue(reconnectSocket);
  await waitForOpen(reconnectSocket);
  const reconnectRoomState = await reconnectNext();
  if (
    reconnectRoomState.type !== "room_state" ||
    reconnectRoomState.participants.length !== 14 ||
    reconnectRoomState.participants.find(
      ({ id }) => id === reconnectTarget.playerId,
    )?.connected !== true
  ) {
    throw new Error(
      `reconnect room state failed: ${JSON.stringify(reconnectRoomState)}`,
    );
  }

  const reconnectGameState = await reconnectNext();
  const reconnectPrivateHand = await reconnectNext();
  if (
    reconnectGameState.type !== "room_state" &&
    reconnectGameState.type !== "game_state"
  ) {
    throw new Error("reconnect did not return synchronized game state");
  }
  const reconnectMessages = [reconnectGameState, reconnectPrivateHand];
  while (
    !reconnectMessages.some(({ type }) => type === "game_state") ||
    !reconnectMessages.some(({ type }) => type === "private_hand")
  ) {
    reconnectMessages.push(await reconnectNext());
    if (reconnectMessages.length > 5) {
      throw new Error("reconnect did not restore game state and private hand");
    }
  }
  const hand = reconnectMessages.find(({ type }) => type === "private_hand");
  if (hand.cards.length !== 27) {
    throw new Error("reconnected player private hand was not restored");
  }

  reconnectSocket.close();
  clients
    .filter((client) => client !== reconnectTarget)
    .forEach(({ socket }) => socket.close());
  console.log("YIHUA_GAME_14_CLIENT_NETWORK_ACCEPTANCE_OK");
} finally {
  child.kill("SIGTERM");
}
