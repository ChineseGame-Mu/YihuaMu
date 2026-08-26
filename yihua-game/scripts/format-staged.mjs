import { execFileSync } from "node:child_process";
import { extname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: projectRoot,
  encoding: "utf8",
}).trim();

const supportedExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".css",
  ".scss",
  ".md",
  ".yaml",
  ".yml",
]);

const staged = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .split("\n")
  .filter((path) => path.startsWith("yihua-game/") && path.length > 11)
  .map((path) => path.slice("yihua-game/".length))
  .filter((path) => !path.startsWith("node_modules/"))
  .filter((path) => !path.startsWith(".githooks/"))
  .filter((path) => supportedExtensions.has(extname(path)));

if (staged.length === 0) {
  process.exit(0);
}

execFileSync("npx", ["prettier", "--write", ...staged], {
  cwd: projectRoot,
  stdio: "inherit",
});

execFileSync("git", ["add", ...staged.map((path) => `yihua-game/${path}`)], {
  cwd: repoRoot,
  stdio: "inherit",
});
