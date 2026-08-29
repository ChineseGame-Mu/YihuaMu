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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForHealth = async () => {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error(`server did not become healthy: ${stderr}`);
};

const createMessageQueue = (socket, onMessage) => {
  const messages = [],
    waiters = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    onMessage?.(message);
    const i = waiters.findIndex(({ predicate }) => predicate(message));
    if (i >= 0) {
      const [w] = waiters.splice(i, 1);
      w.resolve(message);
      return;
    }
    messages.push(message);
  });
  return (predicate, label, timeoutMs = 10000) =>
    new Promise((resolve, reject) => {
      const i = messages.findIndex(predicate);
      if (i >= 0) {
        const [m] = messages.splice(i, 1);
        resolve(m);
        return;
      }
      const waiter = {
        predicate,
        resolve: (m) => {
          clearTimeout(timeout);
          resolve(m);
        },
      };
      const timeout = setTimeout(() => {
        const j = waiters.indexOf(waiter);
        if (j >= 0) waiters.splice(j, 1);
        reject(new Error(`${label} timeout: ${stderr}`));
      }, timeoutMs);
      waiters.push(waiter);
    });
};

const connect = async (name) => {
  const socket = new WebSocket(wsUrl);
  const player = { name, socket, latestState: null };
  player.waitFor = createMessageQueue(socket, (message) => {
    if (message.type === "state") player.latestState = message;
  });
  const connected = await player.waitFor(
    ({ type }) => type === "connected",
    `${name} connected`,
  );
  if (connected.protocol !== "yihua-cleanroom-guandan-v1")
    throw new Error(`unexpected protocol: ${connected.protocol}`);
  socket.send(JSON.stringify({ type: "join", room, name }));
  const joined = await player.waitFor(
    ({ type }) => type === "joined",
    `${name} joined`,
  );
  player.seat = joined.seat;
  return player;
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
    const seat = state.turn,
      player = players[seat];
    if (!player) throw new Error(`invalid turn seat ${seat}`);
    const handCount = state.hand_counts[seat];
    let advanced = false;
    for (let index = 0; index < handCount; index += 1) {
      player.socket.send(
        JSON.stringify({ type: "play", card_indexes: [index] }),
      );
      const result = await player.waitFor(
        ({ type, hand_counts: counts, finish_order: order }) =>
          type === "error" ||
          (type === "state" &&
            (counts?.[seat] < handCount || order?.includes(seat))),
        `seat ${seat} play result`,
        1000,
      );
      if (result.type === "state") {
        state = result;
        advanced = true;
        break;
      }
    }
    if (!advanced) {
      const previousTurn = state.turn,
        previousPasses = state.passes;
      player.socket.send(JSON.stringify({ type: "pass" }));
      state = await player.waitFor(
        ({ type, turn, passes, next_round_phase: phase }) =>
          type === "state" &&
          (phase !== null ||
            turn !== previousTurn ||
            passes !== previousPasses),
        `seat ${seat} pass`,
        1000,
      );
    }
  }

  if (
    state.next_round_phase !== "awaiting_deal" ||
    state.finish_order.length !== 4
  )
    throw new Error(
      `round did not complete correctly: ${JSON.stringify(state)}`,
    );
  const winnerSeat = state.finish_order[0];
  await sleep(50);
  for (const player of players) {
    const snapshot = player.latestState;
    if (
      !snapshot ||
      snapshot.next_round_phase !== "awaiting_deal" ||
      snapshot.finish_order.length !== 4 ||
      snapshot.finish_order[0] !== winnerSeat
    )
      throw new Error(
        `${player.name} final state diverged: ${JSON.stringify(snapshot)}`,
      );
  }

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
  )
    throw new Error(
      "reconnect lost next-round state or created duplicate participant",
    );
  for (const player of players.slice(1)) player.socket.close();
  reconnected.socket.close();
  console.log(
    `YIHUA_GAME_LIVE_LEGACY_COMPLETE_ROUND_OK winner=${winnerSeat} actions=${actions}`,
  );
} finally {
  child.kill("SIGTERM");
}
