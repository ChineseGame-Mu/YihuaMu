import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 36000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomId = "crash-recovery";
const crashCycles = Number(process.env.CRASH_RECOVERY_CYCLES ?? "3");
const directory = await mkdtemp(join(tmpdir(), "yihua-crash-"));
const snapshotPath = join(directory, "runtime.json");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!Number.isInteger(crashCycles) || crashCycles < 1) {
  throw new Error("CRASH_RECOVERY_CYCLES must be a positive integer");
}

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

const nextOfType = async (client, type) => {
  for (let i = 0; i < 20; i += 1) {
    const message = await client.next();
    if (message.type === type) return message;
  }
  throw new Error(`expected ${type} message was not received`);
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

const closeClients = (clients) => {
  clients.forEach(({ socket }) => socket.close());
};

const reconnectAll = async () => {
  const clients = [];
  const snapshots = [];
  for (let seat = 0; seat < 4; seat += 1) {
    const client = await connect(seat);
    clients.push(client);
    const gameState = await nextOfType(client, "game_state");
    const privateHand = await nextOfType(client, "private_hand");
    snapshots.push({ roomState: client.roomState, gameState, privateHand });
  }
  return { clients, snapshots };
};

const assertAlignedSnapshots = (snapshots) => {
  if (
    snapshots.some(
      ({ roomState, gameState, privateHand }) =>
        roomState.revision !== gameState.revision ||
        gameState.revision !== privateHand.revision,
    )
  ) {
    throw new Error("reconnect snapshot revisions disagree after hard crash");
  }
};

const networkLeadingPlay = (leadingPlay) =>
  leadingPlay === null
    ? null
    : {
        seat: leadingPlay.seat,
        cards: leadingPlay.cards.map((card) => card.card ?? card),
      };

let server;
let clients = [];
try {
  server = spawnServer();
  await waitForHealth(server);
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
  let currentStates = await Promise.all(clients.map(({ next }) => next()));
  await Promise.all(clients.map(({ next }) => next()));
  let currentGame = currentStates[0];

  for (let cycle = 1; cycle <= crashCycles; cycle += 1) {
    const checkpoint = await waitForCheckpoint(
      (room) =>
        room.game?.phase === "playing" &&
        room.revision === currentGame.revision &&
        room.game.currentTurn === currentGame.currentTurn &&
        JSON.stringify(room.game.hands.map((hand) => hand.length)) ===
          JSON.stringify(currentGame.handCounts),
    );
    const expected = {
      revision: checkpoint.revision,
      currentTurn: checkpoint.game.currentTurn,
      handCounts: checkpoint.game.hands.map((hand) => hand.length),
      leadingPlay: networkLeadingPlay(checkpoint.game.trick.leadingPlay),
      finishedSeats: checkpoint.game.finishedSeats,
    };

    server.child.kill("SIGKILL");
    await waitForExit(server.child);
    server = undefined;
    closeClients(clients);
    clients = [];

    server = spawnServer();
    await waitForHealth(server);
    const reconnected = await reconnectAll();
    clients = reconnected.clients;
    const snapshots = reconnected.snapshots;
    assertAlignedSnapshots(snapshots);

    const restoredGame = snapshots.at(-1)?.gameState;
    if (
      !restoredGame ||
      restoredGame.type !== "game_state" ||
      restoredGame.revision !== expected.revision ||
      restoredGame.currentTurn !== expected.currentTurn ||
      JSON.stringify(restoredGame.handCounts) !==
        JSON.stringify(expected.handCounts) ||
      JSON.stringify(restoredGame.leadingPlay) !==
        JSON.stringify(expected.leadingPlay) ||
      JSON.stringify(restoredGame.finishedSeats) !==
        JSON.stringify(expected.finishedSeats)
    ) {
      throw new Error(
        `active game was not restored in cycle ${cycle}: ${JSON.stringify(restoredGame)}`,
      );
    }

    const active = clients[restoredGame.currentTurn];
    const activeSnapshot = snapshots[restoredGame.currentTurn];
    if (restoredGame.leadingPlay === null) {
      const nextCard = activeSnapshot.privateHand.cards[0];
      if (!nextCard)
        throw new Error("active player has no card after recovery");
      active.socket.send(
        JSON.stringify({
          type: "play_cards",
          cardIds: [nextCard.id],
          expectedRevision: restoredGame.revision,
          commandId: `continue-play-after-crash-${cycle}`,
        }),
      );
    } else {
      active.socket.send(
        JSON.stringify({
          type: "pass_turn",
          expectedRevision: restoredGame.revision,
          commandId: `continue-pass-after-crash-${cycle}`,
        }),
      );
    }

    currentStates = await Promise.all(
      clients.map((client) => nextOfType(client, "game_state")),
    );
    currentGame = currentStates[0];
    if (
      currentStates.some(
        (state) => state.revision !== restoredGame.revision + 1,
      )
    ) {
      throw new Error(`game did not continue after hard crash cycle ${cycle}`);
    }
  }

  closeClients(clients);
  clients = [];
  server.child.kill("SIGTERM");
  await waitForExit(server.child);
  server = undefined;
  console.log(
    `YIHUA_GAME_ACTIVE_CRASH_RECOVERY_SMOKE_OK cycles=${crashCycles}`,
  );
} finally {
  closeClients(clients);
  if (server?.child) server.child.kill("SIGKILL");
  await rm(directory, { recursive: true, force: true });
}
