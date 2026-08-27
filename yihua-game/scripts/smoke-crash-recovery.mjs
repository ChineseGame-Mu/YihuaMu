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

const waitForCheckpoint = async () => {
  for (let i = 0; i < 80; i += 1) {
    try {
      const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      const room = snapshot.rooms?.find(
        ({ roomId: savedRoomId }) => savedRoomId === roomId,
      );
      if (room) return room.revision;
    } catch {}
    await sleep(50);
  }
  throw new Error("checkpoint was not written before crash");
};

const waitForExit = (child) =>
  new Promise((resolve) => child.once("exit", () => resolve()));

let first;
let second;
try {
  first = spawnServer();
  await waitForHealth(first);
  const created = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roomId, playerCount: 4 }),
  });
  if (created.status !== 201) throw new Error("room creation failed");

  const checkpointRevision = await waitForCheckpoint();
  first.child.kill("SIGKILL");
  await waitForExit(first.child);
  first = undefined;

  second = spawnServer();
  await waitForHealth(second);
  const restored = await fetch(`${baseUrl}/api/rooms/${roomId}`);
  if (!restored.ok) throw new Error("room was not restored after SIGKILL");
  const body = await restored.json();
  if (body.revision !== checkpointRevision || body.room?.roomId !== roomId) {
    throw new Error(`restored checkpoint mismatch: ${JSON.stringify(body)}`);
  }

  second.child.kill("SIGTERM");
  await waitForExit(second.child);
  second = undefined;
  console.log("YIHUA_GAME_CRASH_RECOVERY_SMOKE_OK");
} finally {
  if (first?.child) first.child.kill("SIGKILL");
  if (second?.child) second.child.kill("SIGKILL");
  await rm(directory, { recursive: true, force: true });
}
