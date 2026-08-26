import { execFileSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: projectRoot,
  encoding: "utf8",
}).trim();
const hookPath = resolve(projectRoot, ".githooks", "pre-commit");

chmodSync(hookPath, 0o755);
execFileSync(
  "git",
  ["config", "core.hooksPath", "yihua-game/.githooks"],
  { cwd: repoRoot, stdio: "inherit" },
);

console.log("Yihua Game pre-commit hook installed");
