import { execFileSync } from "node:child_process";

const version = execFileSync("npx", ["prettier", "--version"], {
  encoding: "utf8",
}).trim();

if (version !== "3.4.1") {
  console.error(`Prettier version must be 3.4.1, got ${version}`);
  process.exit(1);
}

console.log(`Prettier ${version} verified`);
