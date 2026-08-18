# Guandan deterministic flow regression cases

This checklist records the deterministic four-player regression cases that must remain covered while the websocket implementation evolves.

1. First + second place are teammates: winner team advances 3 levels and the next deal has 27 cards per seat.
2. First + third place: winner team advances 2 levels.
3. First + fourth place: winner team advances 1 level.
4. Tribute resistance: construct hands explicitly with the required big jokers; do not depend on a shuffled deal. The previous first-place player keeps opening lead.
5. Single tribute exchange: construct four 27-card hands, submit the legal highest tribute and a legal return card, finalize, and assert all four seats still have 27 cards. The tribute giver opens.
6. Double tribute exchange: construct four 27-card hands, submit both legal tribute cards and both legal returns, finalize, and assert all four seats still have 27 cards. The giver of the stronger tribute opens.
7. Tests involving tribute/resistance must use explicit card fixtures rather than `thread_rng()` outcomes so CI behavior is deterministic.

The existing handler tests already cover the 3-level and 2-level settlement paths. The serving-state tests cover single/double exchange mechanics and opening lead. This checklist is intentionally kept next to backend integration tests so missing end-to-end cases remain visible.