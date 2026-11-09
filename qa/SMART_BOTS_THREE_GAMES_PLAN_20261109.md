# Three-game intelligent bots — isolated development acceptance plan (2026-11-09)

Branch: `qa/three-game-smart-bots-20261109` (created from master2). DO NOT merge or deploy automatically.

## Scope and safety
- Shengji (升级) and Zhao Pengyou (找朋友): implement against master2 server authoritative mechanics.
- Guandan (掼蛋): master3 is the separate active development line; port only after independent review and without touching production.
- No OpenAI API needed. No player-private hidden hands may be passed into bot decision functions.
- Do not alter existing deal, bidding, tribute, scoring, card visibility or production deployment as part of this plan.

## Five modules (server-side)
1. **Card tracking**: maintain publicly revealed cards by card identity and multiplicity; remove cards as played; infer remaining counts only from public observations. Reset each deal. Validate deck conservation.
2. **Hand planning**: enumerate only legal candidate actions from authoritative rules; evaluate resulting hand decomposition (singles, pairs, sequences, bombs, trump); use deterministic seeded tie-breaks; never construct a play by guessing legality.
3. **Partnership**: model confirmed team, unknown friend identity and possible opponents separately; avoid overtrumping partner unless strategically necessary; support partner going out; no privileged knowledge of unknown identities.
4. **Endgame search**: use bounded-depth minimax / Monte Carlo determinization using only legal public-information samples; cap nodes/time; always fall back to legal heuristic action. Handle pass, trick reset, partner-out and zero-card terminal cases.
5. **Automated full games**: seeded reproducible four-seat simulation, no UI needed; log initial seed, actions, final score, illegal actions, hangs, decision latency. Compare baseline bot vs new bot with seat/seed swaps and confidence intervals.

## Acceptance tests
- 100% legality: no illegal bot actions in >=10,000 seeded complete games *per game*.
- No hangs: all games terminate within explicit maximum-turn and wall-clock guard; failure logs seed and state.
- Deck conservation: each card accounted for in hand, kitty, revealed play, or trick pile throughout.
- Information isolation: hidden opponent hands and secret friend identities do not enter bot input.
- Card memory: replay public moves and assert exact remaining-public-card counts.
- Hand planning: deterministic fixtures for legal combinations, trump, bombs, follow suit, mandatory responses and passes.
- Partnership: fixtures where partner is winning, partner needs help, friend is unknown, and partner goes out.
- Endgame: deterministic fixtures with 1–5 remaining actions; compare search result with exhaustive reference on small states.
- Baseline comparison: >=1,000 paired seeds with rotated seats; report win rate, 95% confidence interval, mean/p95 latency, illegal moves and stalls. Do not claim strength improvement without results.
- GUI smoke: dealt cards, bid/trump, kitty/discard, visible turn-by-turn plays, trick collection, scoring and new round; verify on actual test deployment.

## Execution order
A. Map existing authoritative state, legal-move generation, robot decision entrypoints and tests on master2.
B. Implement deterministic public-card tracker + unit tests.
C. Implement legal-action ranking and partner policy + unit tests.
D. Add bounded endgame search + budget fallback.
E. Build seeded headless game runner and paired baseline evaluation.
F. Repeat A–E separately for Guandan master3 (separate branch and CI), preserving its own rule system.
G. Build/CI, 10k games/game, four-human regression, downloadable backup and rollback rehearsal before any production release.

## Status at creation
- Repository and branches inspected.
- Isolated branch created.
- Implementation and QA **not yet completed**; this file is an auditable development/acceptance baseline, not evidence of passed tests.
