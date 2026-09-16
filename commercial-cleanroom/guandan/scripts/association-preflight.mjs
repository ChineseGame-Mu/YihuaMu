import { runAssociationDeterministicQa } from "./association-deterministic-qa.mjs";

const deterministic = runAssociationDeterministicQa();
const failed = Object.entries(deterministic)
  .filter(([key, value]) => key !== "allRequiredRulesPassed" && value !== true)
  .map(([key]) => key);

if (deterministic.allRequiredRulesPassed !== true && !failed.includes("allRequiredRulesPassed")) {
  failed.push("allRequiredRulesPassed");
}

console.log(JSON.stringify({ type: "association_preflight", deterministicRuleCoverage: deterministic, failed }));

if (failed.length > 0) {
  throw new Error(`ASSOCIATION PREFLIGHT FAIL: ${failed.join(", ")}`);
}

console.log("ASSOCIATION_PREFLIGHT_OK");
