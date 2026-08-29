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
    } catch {}
    await sleep(50);
  }
  throw new Error(`server did not become healthy: ${stderr}`);
};

const createMessageQueue = (socket) => {
  const messages = [];
  const waiters = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const waiterIndex = waiters.findIndex(({ predicate }) =>
      predicate(message),
    );
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
  if (connected.protocol !== "yihua-cleanroom-guandan-v1")
    throw new Error(`unexpected protocol: ${connected.protocol}`);
  socket.send(JSON.stringify({ type: "join", room, name }));
  const joined = await waitFor(
    ({ type }) => type === "joined",
    `${name} joined`,
  );
  return { name, socket, waitFor, seat: joined.seat };
};

try {
  await waitForHealth();
  const players = [];
  for (const name of ["玩家1", "玩家2", "玩家3", "玩家4"])
    players.push(await connect(name));
  if (
    JSON.stringify(players.map(({ seat }) => seat)) !==
    JSON.stringify([0, 1, 2, 3])
  )
    throw new Error("unexpected seats");

  players[0].socket.send(JSON.stringify({ type: "start", player_count: 4 }));
  const hands = [];
  let state;
  for (const player of players) {
    const started = await player.waitFor(
      ({ type }) => type === "started",
      `${player.name} started`,
    );
    if (started.player_count !== 4 || started.cards_per_player !== 27)
      throw new Error(`invalid started ${player.name}`);
    const hand = await player.waitFor(
      ({ type }) => type === "hand",
      `${player.name} hand`,
    );
    if (hand.cards.length !== 27)
      throw new Error(`invalid hand ${player.name}`);
    hands[player.seat] = hand.cards;
    const opening = await player.waitFor(
      ({ type }) => type === "state",
      `${player.name} state`,
    );
    if (opening.players.length !== 4)
      throw new Error(`invalid state ${player.name}`);
    if (state === undefined) state = opening;
  }

  let actions = 0;
  while (state.next_round_phase === null) {
    if (actions++ > 5000)
      throw new Error("legacy complete-round action cap exceeded");
    const seat = state.turn;
    const player = players[seat];
    if (!player) throw new Error(`invalid turn seat ${seat}`);
    let advanced = false;
    const handCount = state.hand_counts[seat];
    for (let index = 0; index < handCount; index += 1) {
      player.socket.send(
        JSON.stringify({ type: "play", card_indexes: [index] }),
      );
      try {
        const next = await player.waitFor(
          ({ type, hand_counts: counts, finish_order: finishOrder }) =>
            type === "state" &&
            (counts?.[seat] < handCount || finishOrder?.includes(seat)),
          `seat ${seat} legal single`,
        );
        state = next;
        advanced = true;
        break;
      } catch {
        // This single could not beat the current trick; try another card.
      }
    }
    if (!advanced) {
      player.socket.send(JSON.stringify({ type: "pass" }));
      state = await player.waitFor(
        ({ type, turn, passes, next_round_phase: phase }) =>
          type === "state" &&
          (phase !== null || turn !== seat || passes !== state.passes),
        `seat ${seat} pass`,
      );
    }
  }

  if (
    state.next_round_phase !== "awaiting_deal" ||
    state.finish_order.length !== 4
  ) {
    throw new Error(
      `round did not complete correctly: ${JSON.stringify(state)}`,
    );
  }
  const winnerSeat = state.finish_order[0];

  const completionStates = await Promise.all(
    players.map((player) =>
      player.waitFor(
        ({ type, next_round_phase: phase, finish_order: order }) =>
          type === "state" && phase === "awaiting_deal" && order.length === 4,
        `${player.name} round complete`,
      ),
    ),
  );
  if (
    completionStates.some((snapshot) => snapshot.finish_order[0] !== winnerSeat)
  )
    throw new Error("winner diverged across clients");

  players[winnerSeat].socket.send(JSON.stringify({ type: "end_round" }));
  const nextStates = [];
  for (const player of players) {
    const hand = await player.waitFor(
      ({ type, cards }) => type === "hand" && cards.length === 27,
      `${player.name} next-round hand`,
    );
    if (hand.cards.length !== 27)
      throw new Error(`next-round hand invalid for ${player.name}`);
    const next = await player.waitFor(
      ({ type, next_round_phase: phase, hand_counts: counts }) =>
        type === "state" &&
        phase === null &&
        counts.every((count) => count === 27),
      `${player.name} next-round state`,
    );
    nextStates.push(next);
  }
  if (nextStates.some((snapshot) => snapshot.turn !== winnerSeat))
    throw new Error(
      "first-place player did not lead next round on all clients",
    );

  players[0].socket.close();
  await sleep(50);
  const reconnected = await connect("玩家1");
  if (reconnected.seat !== 0)
    throw new Error(`reconnect allocated wrong seat: ${reconnected.seat}`);
  const reconnectState = await reconnected.waitFor(
    ({ type }) => type === "state",
    "reconnect next-round state",
  );
  if (
    reconnectState.players.length !== 4 ||
    reconnectState.hand_counts.some((count) => count !== 27) ||
    reconnectState.turn !== winnerSeat
  ) {
    throw new Error(
      "reconnect lost next-round state or created duplicate participant",
    );
  }

  for (const player of players.slice(1)) player.socket.close();
  reconnected.socket.close();
  console.log(
    `YIHUA_GAME_LIVE_LEGACY_COMPLETE_ROUND_OK winner=${winnerSeat} actions=${actions}`,
  );
} finally {
  child.kill("SIGTERM");
}
