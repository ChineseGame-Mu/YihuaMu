import { spawn } from "node:child_process";

const sizes = [4, 6, 8, 10, 12, 14];
const gamesPerSize = 3;

const run = (players, game) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/soak-core.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SOAK_DURATION_MS: "1500",
        SOAK_PLAYER_COUNTS: String(players),
        SOAK_RECONNECT_EVERY: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`${players}p game ${game} exited ${code}`));
        return;
      }
      const bad = /deadlocks=(?!0\b)|stateErrors=(?!0\b)|crashes=(?!0\b)/.test(
        output,
      );
      if (bad) {
        reject(
          new Error(`${players}p game ${game} reported an integrity failure`),
        );
        return;
      }
      resolve();
    });
  });

for (const players of sizes) {
  for (let game = 1; game <= gamesPerSize; game += 1) {
    console.log(`THREE_GAME_MATRIX_BEGIN players=${players} game=${game}`);
    await run(players, game);
    console.log(`THREE_GAME_MATRIX_PASS players=${players} game=${game}`);
  }
}

console.log("THREE_GAME_MATRIX_PASS all=18");
