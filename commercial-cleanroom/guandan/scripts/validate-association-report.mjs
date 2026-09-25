import fs from "node:fs";

const logPath = process.argv[2] ?? "/tmp/full-rules-team-strategy.log";
const reportJson = process.env.QA_REPORT_JSON ?? "/tmp/guandan-team-strategy-report.json";
const reportMd = process.env.QA_REPORT_MD ?? "/tmp/guandan-team-strategy-report.md";

const raw = fs.readFileSync(logPath, "utf8");
const parsed = raw.trim().split(/\n+/).map((line) => {
  try { return JSON.parse(line); } catch { return null; }
}).filter(Boolean);
const final = [...parsed].reverse().find((value) => value?.strategyQa || value?.qaReport);
if (!final) throw new Error("ASSOCIATION QA FAILURES: strategy QA telemetry/report missing");
const q = final.strategyQa ?? final.qaReport;
const failures = [];
const add = (condition, message) => { if (condition) failures.push(message); };

add(q.qaStandard !== "guandan-association-full-rules-team-strategy-v3", `wrong qaStandard: ${q.qaStandard}`);
add(q.ruleProfile !== "national-competitive", `wrong/implicit ruleProfile: ${q.ruleProfile}`);
add(Number(q.playerCount) !== 4, `association mode must be exactly 4 players, got ${q.playerCount}`);
add(Number(q.deckSize) !== 108, `association mode must use exactly 108 cards, got ${q.deckSize}`);
add(!Array.isArray(q.cardsPerPlayer) ? Number(q.cardsPerPlayer) !== 27 : q.cardsPerPlayer.some((n) => Number(n) !== 27), "each of four players must hold 27 cards after deal");
add(Boolean(q.deadlocks || q.stateErrors || q.crashes), `integrity failures: ${JSON.stringify({ deadlocks:q.deadlocks, stateErrors:q.stateErrors, crashes:q.crashes })}`);
add(!q.completedThroughA, "no team completed the formal 2 -> A -> pass-A victory path");
add(!q.winnerTeam, "winnerTeam missing");
add(q.hiddenInformationIsolation !== true, "bot can access hidden teammate/opponent/future-deck information");
add(q.illegalSignallingProtection !== true, "illegal signalling / side-channel protection missing");

const requiredTypes = ["single","pair","triple","fullHouse","straight","consecutivePairs","consecutiveTriples","straightFlush","bomb4","bomb5","bomb6Plus","jokerBomb","heartLevelWildcardPlay"];
const coverage = q.playTypeCoverage ?? {};
for (const type of requiredTypes) add(!(Number(coverage[type]) > 0), `required real play type not observed: ${type}`);

const requiredRules = ["fourPlayerTwoTeamsOppositePartners","twoDeck108Cards","twentySevenCardsEach","levelRankOrdering","levelRankNaturalSequenceBehavior","heartLevelWildcardSingleBehavior","heartLevelWildcardPair","heartLevelWildcardTriple","heartLevelWildcardFullHouse","heartLevelWildcardStraight","heartLevelWildcardConsecutivePairs","heartLevelWildcardConsecutiveTriples","heartLevelWildcardStraightFlush","heartLevelWildcardBomb","heartLevelWildcardDoubleUse","heartLevelWildcardCannotRepresentJoker","heartLevelWildcardDeterministicInterpretation","straightAceLow","straightAceHigh","rejectKingAceTwoWrap","bomb4Hierarchy","bomb5Hierarchy","bomb6Hierarchy","bomb7Hierarchy","bomb8Hierarchy","straightFlushBombHierarchy","jokerBombHighest","sameTypeSameSizeComparison","fullHouseTripleControlsComparison","passAndLeadReset","finishOrderAndAutoLastPlace","partnerCatchLead","singleTribute","doubleTribute","returnTribute","antiTribute","heartLevelExcludedFromMandatoryTribute","cardConservationAcrossTribute","promotionByPlacements","levelKToA","passAEndCondition","illegalPlayStateAtomicity","allRequiredRulesPassed"];
const deterministic = q.deterministicRuleCoverage ?? {};
for (const rule of requiredRules) add(deterministic[rule] !== true, `deterministic rule missing/failed: ${rule}`);

const requiredTactics = ["handStructureAssessment","roleSelectionFromLegalInformation","dynamicRoleSwitch","leadSmallBurdenWithoutBreakingStructure","partnerFeeding","partnerYielding","minimumSufficientOvertake","opponentSprintBlock","bombConservation","bombForControlWithFollowup","wildcardValueOptimization","playedCardMemory","remainingCardInferenceWithoutHiddenInfo","endgameModeSwitch","partnerCatchLeadExploitation","upgradeOutcomeOptimization","tributeReturnStrategy"];
const tactics = q.expertTacticalCoverage ?? {};
for (const tactic of requiredTactics) add(tactics[tactic]?.passed !== true && tactics[tactic] !== true, `expert tactic missing/failed: ${tactic}`);

if (!Array.isArray(q.teams) || q.teams.length !== 2) failures.push("standard table must report exactly two teams");
else {
  for (const team of q.teams) {
    if (!team.teamName) failures.push("teamName missing");
    if (!Array.isArray(team.players) || team.players.length !== 2) failures.push(`${team.teamName ?? "team"}: standard team must contain exactly 2 players`);
    if (!Array.isArray(team.rounds) || team.rounds.length < 1) failures.push(`${team.teamName ?? "team"}: round analysis missing`);
    else {
      let coordinationEvents = 0;
      for (const round of team.rounds) {
        if (!round.levelBefore || !round.levelAfter) failures.push(`${team.teamName}: level progression missing in round ${round.round}`);
        if (!round.roleAssessment) failures.push(`${team.teamName}: legal-information role assessment missing in round ${round.round}`);
        if (!Array.isArray(round.coordinationMethods)) failures.push(`${team.teamName}: coordinationMethods missing in round ${round.round}`);
        if (!Array.isArray(round.keyCoordinationEvents)) failures.push(`${team.teamName}: keyCoordinationEvents missing in round ${round.round}`);
        else coordinationEvents += round.keyCoordinationEvents.length;
        if (!round.winReason && round.wonOrAdvanced) failures.push(`${team.teamName}: win/advance reason missing in round ${round.round}`);
      }
      if (coordinationEvents < 1) failures.push(`${team.teamName}: no real teammate-coordination event was recorded`);
    }
  }
}

add(q.humanStyleChecks?.passed !== true, "human-style natural play checks did not pass");
add(q.teamStrategyChecks?.passed !== true, "teammate-support strategy checks did not pass");
add(q.heartLevelWildcardChecks?.passed !== true, "heart-level wildcard / 逢人配 checks did not pass");
add(q.tributeChecks?.passed !== true, "tribute/return/anti-tribute checks did not pass");
add(q.cardConservationChecks?.passed !== true, "108-card conservation checks did not pass");
add(q.expertTacticalChecks?.passed !== true, "expert tactical suite did not pass");

// Check the aggregate last so it can never hide the underlying causes again.
add(q.associationCompliance !== true, "associationCompliance not proven");

fs.writeFileSync(reportJson, JSON.stringify({ ...q, validationFailures: failures }, null, 2));
if (typeof q.markdownReport === "string" && q.markdownReport.trim()) fs.writeFileSync(reportMd, `${q.markdownReport.trim()}\n\n## Validation failures\n${failures.length ? failures.map((x) => `- ${x}`).join("\n") : "- none"}\n`);
else failures.push("human-readable Markdown team analysis report missing");

console.log(JSON.stringify({ type:"association_validation_summary", failureCount:failures.length, failures }));
if (failures.length) throw new Error(`ASSOCIATION QA FAILURES (${failures.length}): ${failures.join(" | ")}`);
console.log(JSON.stringify({ type:"guandan_association_standard_full_rules_team_strategy_pass", qaStandard:q.qaStandard, ruleProfile:q.ruleProfile, associationCompliance:q.associationCompliance, winnerTeam:q.winnerTeam, completedThroughA:q.completedThroughA }));
