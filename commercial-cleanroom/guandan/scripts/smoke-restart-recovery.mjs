import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 35000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const roomId = "restart-recovery";
const directory = await mkdtemp(join(tmpdir(), "yihua-restart-"));
const snapshotPath = join(directory, "runtime.json");

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const spawnServer = () => {
  const child = spawn(process.execPath, ["dist/main.js"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      YIHUA_SNAPSHOT_PATH: snapshotPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return { child, stderr: () => stderr };
};

const waitForHealth = async (stderr) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server may still be starting.
    }
    await sleep(50);
  }
  throw new Error(`server did not become healthy: ${stderr()}`);
};

const waitForExit = (child, stderr) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`server did not exit after SIGTERM: ${stderr()}`));
    }, 5000);
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0 || signal === "SIGTERM") {
        resolve();
      } else {
        reject(new Error(`server exited with ${code}/${signal}: ${stderr()}`));
      }
    });
  });

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
        const index = waiters.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error("websocket message timeout"));
      }, 5000);
      waiters.push({
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
      });
    });
};

const readUntil = async (next, type) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const message = await next();
    if (message.type === "error") {
      throw new Error(`websocket error: ${JSON.stringify(message)}`);
    }
    if (message.type === type) return message;
  }
  throw new Error(`did not receive ${type}`);
};

const connect = async (playerId) => {
  const socket = new WebSocket(
    `ws://127.0.0.1:${port}/ws/rooms/${roomId}?playerId=${playerId}`,
  );
  const next = createMessageQueue(socket);
  await readUntil(next, "room_state");
  return { playerId, socket, next };
};

const closeSocket = (socket) =>
  new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    socket.addEventListener("close", () => resolve(), { once: true });
    socket.close();
  });

let first;
let second;
try {
  first = spawnServer();
  await waitForHealth(first.stderr);

  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, playerCount: 4 }),
  });
  if (created.status !== 201) throw new Error("room creation failed");

  const clients = [];
  for (let seat = 0; seat < 4; seat += 1) {
    const client = await connect(`p${seat}`);
    clients.push(client);
    client.socket.send(
      JSON.stringify({
        type: "join_room",
        roomId,
        playerId: client.playerId,
        name: `玩家${seat + 1}`,
        seat,
      }),
    );
    for (const connected of clients) {
      await readUntil(connected.next, "room_state");
    }
  }

  clients[0].socket.send(JSON.stringify({ type: "start_game" }));
  const gameStates = [];
  const privateHands = [];
  for (const client of clients) {
    gameStates.push(await readUntil(client.next, "game_state"));
    privateHands.push(await readUntil(client.next, "private_hand"));
  }
  const initialGame = gameStates[0];
  const leaderSeat = initialGame.currentTurn;
  const leader = clients[leaderSeat];
  const leaderHand = privateHands[leaderSeat];
  const selected = leaderHand.cards[0];
  if (!leader || !selected) throw new Error("opening leader card missing");

  leader.socket.send(
    JSON.stringify({
      type: "play_cards",
      cardIds: [selected.id],
      expectedRevision: initialGame.revision,
      commandId: "before-restart-play",
    }),
  );
  const afterPlay = await readUntil(leader.next, "game_state");
  if (
    afterPlay.leadingPlay?.seat !== leaderSeat ||
    afterPlay.handCounts[leaderSeat] !== 26
  ) {
    throw new Error(
      `play before restart was lost: ${JSON.stringify(afterPlay)}`,
    );
  }

  await Promise.all(clients.map(({ socket }) => closeSocket(socket)));
  first.child.kill("SIGTERM");
  await waitForExit(first.child, first.stderr);
  first = undefined;

  second = spawnServer();
  await waitForHealth(second.stderr);

  const leaderReconnect = await connect(`p${leaderSeat}`);
  const recoveredGame = await readUntil(leaderReconnect.next, "game_state");
  const recoveredHand = await readUntil(leaderReconnect.next, "private_hand");
  if (
    recoveredGame.currentTurn !== afterPlay.currentTurn ||
    recoveredGame.leadingPlay?.seat !== leaderSeat ||
    recoveredGame.handCounts[leaderSeat] !== 26 ||
    recoveredHand.cards.some(({ id }) => id === selected.id)
  ) {
    throw new Error(
      `recovered game differs from pre-restart state: ${JSON.stringify(recoveredGame)}`,
    );
  }

  const currentSeat = recoveredGame.currentTurn;
  const current =
    currentSeat === leaderSeat
      ? leaderReconnect
      : await connect(`p${currentSeat}`);
  const currentGame =
    currentSeat === leaderSeat
      ? recoveredGame
      : await readUntil(current.next, "game_state");
  if (currentSeat !== leaderSeat) {
    await readUntil(current.next, "private_hand");
  }

  current.socket.send(
    JSON.stringify({
      type: "pass_turn",
      expectedRevision: currentGame.revision,
      commandId: "after-restart-pass",
    }),
  );
  const afterRestartPass = await readUntil(current.next, "game_state");
  if (afterRestartPass.revision !== currentGame.revision + 1) {
    throw new Error("game did not continue after restart");
  }

  await closeSocket(leaderReconnect.socket);
  if (current !== leaderReconnect) await closeSocket(current.socket);
  second.child.kill("SIGTERM");
  await waitForExit(second.child, second.stderr);
  second = undefined;
  console.log("YIHUA_GAME_RESTART_RECOVERY_SMOKE_OK");
} finally {
  if (first?.child) first.child.kill("SIGKILL");
  if (second?.child) second.child.kill("SIGKILL");
  await rm(directory, { recursive: true, force: true });
}
