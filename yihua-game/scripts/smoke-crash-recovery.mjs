import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 36000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomId = "crash-recovery";
const directory = await mkdtemp(join(tmpdir(), "yihua-crash-"));
const snapshotPath = join(directory, "runtime.json");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const spawnServer = () => {
  const child = spawn(process.execPath, ["dist/main.js"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      YIHUA_SNAPSHOT_PATH: snapshotPath,
      YIHUA_CHECKPOINT_MS: "100",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return { child, stderr: () => stderr };
};

const waitForHealth = async (server) => {
  for (let i = 0; i < 80; i += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {}
    await sleep(50);
  }
  throw new Error(`server did not become healthy: ${server.stderr()}`);
};

const waitForCheckpoint = async (predicate) => {
  for (let i = 0; i < 80; i += 1) {
    try {
      const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      const room = snapshot.rooms?.find(
        ({ roomId: savedRoomId }) => savedRoomId === roomId,
      );
      if (room && predicate(room)) return room;
    } catch {}
    await sleep(50);
  }
  throw new Error("expected checkpoint was not written before crash");
};

const waitForExit = (child) =>
  new Promise((resolve) => child.once("exit", () => resolve()));

const createQueue = (socket) => {
  const messages = [];
  const waiters = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else messages.push(message);
  });
  return () =>
    new Promise((resolve, reject) => {
      const message = messages.shift();
      if (message) return resolve(message);
      const timeout = setTimeout(
        () => reject(new Error("websocket message timeout")),
        10000,
      );
      waiters.push((value) => {
        clearTimeout(timeout);
        resolve(value);
      });
    });
};

const connect = async (seat) => {
  const playerId = `p${seat}`;
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/ws/rooms/${roomId}?playerId=${playerId}`,
  );
  const next = createQueue(socket);
  const roomState = await next();
  return { seat, playerId, socket, next, roomState };
};

const joinRoom = async (client, revision) => {
  client.socket.send(
    JSON.stringify({
      type: "join_room",
      roomId,
      playerId: client.playerId,
      name: `玩家${client.seat + 1}`,
      seat: client.seat,
      expectedRevision: revision,
      commandId: `join-${client.seat}`,
    }),
  );
};

let first;
let second;
let clients = [];
try {
  first = spawnServer();
  await waitForHealth(first);
  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, playerCount: 4 }),
  });
  if (created.status !== 201) throw new Error("room creation failed");

  clients = await Promise.all(
    Array.from({ length: 4 }, (_, seat) => connect(seat)),
  );
  let revision = clients[0].roomState.revision;
  for (const client of clients) {
    await joinRoom(client, revision);
    const updates = await Promise.all(clients.map(({ next }) => next()));
    revision = updates[0].revision;
  }
  clients[0].socket.send(
    JSON.stringify({
      type: "start_game",
      expectedRevision: revision,
      commandId: "start-before-crash",
    }),
  );
  await Promise.all(clients.map(({ next }) => next()));
  const gameStates = await Promise.all(clients.map(({ next }) => next()));
  const hands = await Promise.all(clients.map(({ next }) => next()));
  const game = gameStates[0];
  const leader = game.currentTurn;
  const card = hands[leader].cards[0];
  clients[leader].socket.send(
    JSON.stringify({
      type: "play_cards",
      cardIds: [card.id],
      expectedRevision: game.revision,
      commandId: "play-before-crash",
    }),
  );
  const afterPlayStates = await Promise.all(clients.map(({ next }) => next()));
  const afterPlay = afterPlayStates[0];
  await Promise.all(clients.map(({ next }) => next()));

  const checkpoint = await waitForCheckpoint(
    (room) =>
      room.game?.phase === "playing" &&
      room.revision === afterPlay.revision &&
      room.game?.trick?.leadingPlay?.cards?.[0]?.id === card.id,
  );
  const expectedTurn = checkpoint.game.currentTurn;
  const expectedCounts = checkpoint.game.hands.map((hand) => hand.length);

  first.child.kill("SIGKILL");
  await waitForExit(first.child);
  first = undefined;
  clients.forEach(({ socket }) => socket.close());
  clients = [];

  second = spawnServer();
  await waitForHealth(second);
  clients = await Promise.all(
    Array.from({ length: 4 }, (_, seat) => connect(seat)),
  );
  const reconnectSnapshots = await Promise.all(
    clients.map(async (client) => {
      const gameState = await client.next();
      const privateHand = await client.next();
      return { roomState: client.roomState, gameState, privateHand };
    }),
  );
  const restoredGame = reconnectSnapshots[0].gameState;
  if (
    restoredGame.type !== "game_state" ||
    restoredGame.currentTurn !== expectedTurn ||
    JSON.stringify(restoredGame.handCounts) !== JSON.stringify(expectedCounts) ||
    restoredGame.leadingPlay?.cards?.[0]?.id !== card.id
  ) {
    throw new Error(
      `active game was not restored: ${JSON.stringify(restoredGame)}`,
    );
  }
  if (
    reconnectSnapshots.some(
      ({ roomState, gameState, privateHand }) =>
        roomState.revision !== gameState.revision ||
        gameState.revision !== privateHand.revision,
    )
  ) {
    throw new Error("reconnect snapshot revisions disagree after hard crash");
  }

  const active = clients[expectedTurn];
  active.socket.send(
    JSON.stringify({
      type: "pass_turn",
      expectedRevision: restoredGame.revision,
      commandId: "continue-after-crash",
    }),
  );
  const continued = await Promise.all(clients.map(({ next }) => next()));
  if (
    continued.some(
      (state) =>
        state.type !== "game_state" ||
        state.revision !== restoredGame.revision + 1 ||
        !state.passedSeats.includes(expectedTurn),
    )
  ) {
    throw new Error("game did not continue after hard-crash reconnect");
  }

  clients.forEach(({ socket }) => socket.close());
  clients = [];
  second.child.kill("SIGTERM");
  await waitForExit(second.child);
  second = undefined;
  console.log("YIHUA_GAME_ACTIVE_CRASH_RECOVERY_SMOKE_OK");
} finally {
  clients.forEach(({ socket }) => socket.close());
  if (first?.child) first.child.kill("SIGKILL");
  if (second?.child) second.child.kill("SIGKILL");
  await rm(directory, { recursive: true, force: true });
}
