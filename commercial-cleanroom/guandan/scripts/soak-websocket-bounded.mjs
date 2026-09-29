import { spawn } from "node:child_process";

const durationMs = Number(process.env.SOAK_DURATION_MS ?? 3 * 60 * 60 * 1000);
const segmentMs = Number(process.env.SOAK_SEGMENT_MS ?? 60_000);

if (!Number.isFinite(durationMs) || durationMs <= 0) {
  throw new Error("SOAK_DURATION_MS must be positive");
}
if (!Number.isFinite(segmentMs) || segmentMs <= 0) {
  throw new Error("SOAK_SEGMENT_MS must be positive");
}

const startedAt = Date.now();
const deadline = startedAt + durationMs;
let segments = 0;

while (Date.now() < deadline) {
  const remaining = deadline - Date.now();
  const childDuration = Math.max(1, Math.min(segmentMs, remaining));
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/soak-websocket.mjs"], {
      env: {
        ...process.env,
        SOAK_DURATION_MS: String(childDuration),
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (exitCode, signal) => {
      if (signal) reject(new Error(`soak segment stopped by ${signal}`));
      else resolve(exitCode ?? 1);
    });
  });
  if (code !== 0) throw new Error(`soak segment failed with exit code ${code}`);
  segments += 1;
}

console.log(
  JSON.stringify({
    type: "bounded_websocket_soak_complete",
    elapsedMs: Date.now() - startedAt,
    durationMs,
    segmentMs,
    segments,
  }),
);
