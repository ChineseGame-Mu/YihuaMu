import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: projectRoot,
  encoding: "utf8",
}).trim();

const staged = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .split("\n")
  .filter((path) => path.startsWith("yihua-game/") && path.length > 11)
  .map((path) => path.slice("yihua-game/".length));

if (staged.length === 0) {
  process.exit(0);
}

execFileSync("npx", ["prettier", "--write", ...staged], {
  cwd: projectRoot,
  stdio: "inherit",
});

execFileSync(
  "git",
  ["add", ...staged.map((path) => `yihua-game/${path}`)],
  { cwd: repoRoot, stdio: "inherit" },
);
