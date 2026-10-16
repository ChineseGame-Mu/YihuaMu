# Advanced Guandan robot strategy QA — 2026-10-16

Base commit: 682efbca18d5a56aff93bf81c39d39985d17429e (Draft PR #84).
Scope: robot strategy only. Do not merge or deploy this branch. The approved homepage and canonical production alias yihua-mu.vercel.app must remain untouched.

## Evidence reviewed
- GitHub Actions CI run 38472211413 passed at base SHA, including four-robot three-consecutive-full-deals simulation.
- Robot decision loop in backend/src/guandan_handler.rs enumerates singles and same-rank subsets only. Existing tests cover leading a pair while preserving a joker and passing when partner controls a safe trick.
- Simulation proves game termination, not full combination coverage or strategic strength.

## Blocking test cases to implement and run
1. Fresh lead with legal straight and no cheaper finishing move: enumerate and play a complete straight; assert legal classification, remaining hand and turn.
2. Fresh lead with consecutive pairs: enumerate and play the complete consecutive-pairs combination.
3. Fresh lead with three-with-two: enumerate and play exactly five cards as a legal full house.
4. Table displays a beatable straight / consecutive pairs / three-with-two: respond with a matching legal higher combination rather than automatically passing.
5. Bomb conservation: avoid a bomb when a lower-cost legal non-bomb beats the table; use bomb when opponent has one card and doing so prevents an immediate loss.
6. Partner cooperation: pass on partner's winning trick when opponents are safe; intervene when opponent is about to finish.
7. Endgame: evaluate opponent remaining card counts, do not sacrifice an immediate legal finish to a generic premium-card penalty.
8. Level-card and joker preservation: compare ranked candidate choices under multiple levels, including King, without violating rules.
9. Deterministic regression: use fixed hands / RNG seeds, validate every played combination, ensure no illegal plays and no deadlocks.
10. Four independent network clients, three complete games, reconnect and robot substitution; collect logs tied to the exact tested SHA.

## Release gate
Do not call advanced robot strategy QA passed until tests 1–10 have execution evidence on the same candidate SHA. Do not conflate simulation with real-client QA. Preserve the user-approved homepage screenshot; do not restore the rejected starting-player selector. Runtime backup plus restoration drill are required before production promotion.
