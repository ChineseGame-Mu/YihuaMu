import { createServerRuntime } from "./core/server-runtime.js";
import { createNodeHttpServer } from "./node-server.js";
import {
  loadRuntimeSnapshotFile,
  saveRuntimeSnapshotFile,
} from "./node-runtime-store.js";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST ?? "0.0.0.0";
const snapshotPath = process.env.YIHUA_SNAPSHOT_PATH?.trim();
const checkpointMs = Number(process.env.YIHUA_CHECKPOINT_MS ?? "5000");

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT must be an integer from 1 through 65535");
}
if (!Number.isInteger(checkpointMs) || checkpointMs < 100) {
  throw new Error("YIHUA_CHECKPOINT_MS must be an integer of at least 100");
}

const snapshot = snapshotPath
  ? await loadRuntimeSnapshotFile(snapshotPath)
  : undefined;
const runtime = createServerRuntime(snapshot);
const server = createNodeHttpServer(runtime);
let shuttingDown = false;
let checkpointRunning = false;

const persist = async (): Promise<void> => {
  if (!snapshotPath || checkpointRunning) return;
  checkpointRunning = true;
  try {
    await saveRuntimeSnapshotFile(snapshotPath, runtime.snapshot());
  } finally {
    checkpointRunning = false;
  }
};

const checkpoint = snapshotPath
  ? setInterval(() => {
      void persist().catch((error) =>
        console.error("failed to checkpoint Yihua Game runtime", error),
      );
    }, checkpointMs)
  : undefined;
checkpoint?.unref();

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (checkpoint) clearInterval(checkpoint);
  server.close();
  try {
    await persist();
    process.exitCode = 0;
  } catch (error) {
    console.error("failed to persist Yihua Game runtime", error);
    process.exitCode = 1;
  } finally {
    console.log(`Yihua Game stopped after ${signal}`);
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

server.listen(port, host, () => {
  console.log(`Yihua Game listening on http://${host}:${port}`);
});
