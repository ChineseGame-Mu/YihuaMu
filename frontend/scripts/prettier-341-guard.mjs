import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_PRETTIER = "3.4.1";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, "..");
const repoRoot = resolve(frontendRoot, "..");
const prettierCli = resolve(
  frontendRoot,
  "node_modules",
  "prettier",
  "bin",
  "prettier.cjs",
);

const fail = (message) => {
  console.error(`\n[prettier-341-guard] ${message}\n`);
  process.exit(1);
};

const packageJson = JSON.parse(
  readFileSync(resolve(frontendRoot, "package.json"), "utf8"),
);
const declared = packageJson.devDependencies?.prettier;
if (declared !== REQUIRED_PRETTIER) {
  fail(
    `frontend/package.json must pin prettier exactly to ${REQUIRED_PRETTIER}; found ${String(declared)}`,
  );
}

if (!existsSync(prettierCli)) {
  fail("local Prettier is not installed. Run `yarn install --frozen-lockfile` in frontend first.");
}

const prettierVersion = execFileSync(process.execPath, [prettierCli, "--version"], {
  cwd: frontendRoot,
  encoding: "utf8",
}).trim();
if (prettierVersion !== REQUIRED_PRETTIER) {
  fail(
    `installed Prettier must be ${REQUIRED_PRETTIER}; found ${prettierVersion}. Delete node_modules and reinstall from the lockfile.`,
  );
}

const mode = process.argv[2] ?? "check";
const supported = new Set(["check", "write", "staged"]);
if (!supported.has(mode)) {
  fail(`unsupported mode '${mode}'. Use check, write, or staged.`);
}

const runPrettier = (args) => {
  execFileSync(process.execPath, [prettierCli, ...args], {
    cwd: frontendRoot,
    stdio: "inherit",
  });
};

if (mode === "check") {
  runPrettier(["src", "--check"]);
  console.log(`[prettier-341-guard] PASS: frontend uses Prettier ${REQUIRED_PRETTIER} and src is formatted.`);
  process.exit(0);
}

if (mode === "write") {
  runPrettier(["src", "--write"]);
  runPrettier(["src", "--check"]);
  console.log(`[prettier-341-guard] FIXED: frontend src formatted with Prettier ${REQUIRED_PRETTIER}.`);
  process.exit(0);
}

const stagedOutput = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
  { cwd: repoRoot, encoding: "utf8" },
).trim();

const formatExtensions = /\.(?:js|jsx|ts|tsx|css|json|md|yml|yaml)$/i;
const stagedFrontendFiles = stagedOutput
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => file.startsWith("frontend/"))
  .filter((file) => formatExtensions.test(file))
  .map((file) => ({ repoPath: file, frontendPath: relative(frontendRoot, resolve(repoRoot, file)) }));

if (stagedFrontendFiles.length === 0) {
  console.log(`[prettier-341-guard] PASS: no staged frontend files need formatting; version ${REQUIRED_PRETTIER} verified.`);
  process.exit(0);
}

const frontendPaths = stagedFrontendFiles.map(({ frontendPath }) => frontendPath);
runPrettier([...frontendPaths, "--write"]);
runPrettier([...frontendPaths, "--check"]);
execFileSync("git", ["add", "--", ...stagedFrontendFiles.map(({ repoPath }) => repoPath)], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(
  `[prettier-341-guard] PASS: auto-formatted and re-staged ${stagedFrontendFiles.length} frontend file(s) with Prettier ${REQUIRED_PRETTIER}.`,
);
