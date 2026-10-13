import { spawn } from "node:child_process";

const port = 34000 + Math.floor(Math.random() * 1000);
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

try {
  await waitForHealth();
  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId: "gameplay-smoke", playerCount: 4 }),
  });
  if (created.status !== 201) {
    throw new Error(`room creation failed: ${created.status}`);
  }

  const clients = Array.from({ length: 4 }, (_, seat) => {
    const playerId = `p${seat}`;
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/ws/rooms/gameplay-smoke?playerId=${playerId}`,
    );
    return {
      playerId,
      seat,
      socket,
      next: createMessageQueue(socket),
    };
  });

  const initial = await nextBatch(clients);
  if (initial.some(({ type }) => type !== "room_state")) {
    throw new Error("initial room snapshots failed");
  }

  for (const client of clients) {
    const latest = initial[0];
    client.socket.send(
      JSON.stringify({
        type: "join_room",
        roomId: "gameplay-smoke",
        playerId: client.playerId,
        name: `玩家${client.seat + 1}`,
        seat: client.seat,
        commandId: `join-${client.seat}`,
        expectedRevision: latest.revision + client.seat,
      }),
    );
    const updates = await nextBatch(clients);
    if (updates.some(({ type }) => type !== "room_state")) {
      throw new Error(`join broadcast failed for seat ${client.seat}`);
    }
  }

  const revisionBeforeStart = initial[0].revision + 4;
  clients[0].socket.send(
    JSON.stringify({
      type: "start_game",
      expectedRevision: revisionBeforeStart,
      commandId: "start-gameplay-smoke",
    }),
  );

  const startRoomStates = await nextBatch(clients);
  if (startRoomStates.some(({ type }) => type !== "room_state")) {
    throw new Error("start room-state broadcast failed");
  }
  const startGameStates = await nextBatch(clients);
  const startGame = startGameStates[0];
  if (
    startGameStates.some(({ type }) => type !== "game_state") ||
    startGame.handCounts.some((count) => count !== 27)
  ) {
    throw new Error(`invalid start game state: ${JSON.stringify(startGame)}`);
  }
  const startHands = await nextBatch(clients);
  if (startHands.some(({ type }) => type !== "private_hand")) {
    throw new Error("private hands were not delivered");
  }

  const leaderSeat = startGame.currentTurn;
  const leaderHand = startHands[leaderSeat];
  const selected = leaderHand.cards[0];
  if (!selected) throw new Error("leader has no card to play");

  clients[leaderSeat].socket.send(
    JSON.stringify({
      type: "play_cards",
      cardIds: [selected.id],
      expectedRevision: startGame.revision,
      commandId: "transport-play-1",
    }),
  );

  const afterPlayStates = await nextBatch(clients);
  const afterPlay = afterPlayStates[0];
  if (
    afterPlayStates.some(({ type }) => type !== "game_state") ||
    afterPlay.revision !== startGame.revision + 1 ||
    afterPlay.handCounts[leaderSeat] !== 26 ||
    afterPlay.leadingPlay?.seat !== leaderSeat
  ) {
    throw new Error(`play did not synchronize: ${JSON.stringify(afterPlay)}`);
  }
  const afterPlayHand = await clients[leaderSeat].next();
  if (
    afterPlayHand.type !== "private_hand" ||
    afterPlayHand.cards.length !== 26 ||
    afterPlayHand.cards.some(({ id }) => id === selected.id)
  ) {
    throw new Error("leader private hand did not remove exact physical card");
  }

  const responderSeat = afterPlay.currentTurn;
  clients[responderSeat].socket.send(
    JSON.stringify({
      type: "pass_turn",
      expectedRevision: afterPlay.revision,
      commandId: "transport-pass-1",
    }),
  );

  const afterPassStates = await nextBatch(clients);
  const afterPass = afterPassStates[0];
  if (
    afterPassStates.some(({ type }) => type !== "game_state") ||
    afterPass.revision !== afterPlay.revision + 1 ||
    !afterPass.passedSeats.includes(responderSeat)
  ) {
    throw new Error(`pass did not synchronize: ${JSON.stringify(afterPass)}`);
  }

  clients.forEach(({ socket }) => socket.close());
  console.log("YIHUA_GAME_LIVE_GAMEPLAY_TRANSPORT_SMOKE_OK");
} finally {
  child.kill("SIGTERM");
}
