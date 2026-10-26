# PR90 + PR89 robot backend-only isolated QA (2026-10-17)

## Hard safety boundaries
- Production baseline: deployment `dpl_Drf4s1hQRrKrG1vHapaZmStCh8HS`, SHA `3031e1a2375bb9870b409a17cb240af42cae435c`.
- PR90 baseline: `25ed25b5fdd2c8d4a8cfe8e4d8cb89cc658c1358`, CI run `39028586695` SUCCESS.
- Robot strategy source: PR89 `66041751368ca5a8b9591b77728369816173d5b5`.
- This branch is based on PR90, and copies ONLY PR89's `backend/src/guandan_handler.rs` as a source file; frontend is unchanged.
- Branches are diverged; no merge of PR89 and no overwrite of approved homepage.
- Explicitly rejected SHA `06e422f`; do not promote it.
- Never change the three-game Render site. Never bypass SSO.
- Git source backups are NOT equivalent to a durable room-state backup or verified recovery.

## Status at branch creation
- Existing PR90 CI: PASS; source backup branches: reported and independently listed.
- This integrated SHA frontend, Rust, K-level anti-tribute and four-robot 3-deal tests: PENDING.
- 11 live game checks: NOT VERIFIED on this SHA.
- Four-human networked 3-game run: NOT VERIFIED; four robots cannot substitute.
- Live browser QA: BLOCKED by SSO; do not bypass.
- Persistent runtime export and disaster recovery restore drill: NOT VERIFIED.
- Production deployment: NO-GO unless every required gate has actual evidence.

## Eleven required gates (all unverified on integration SHA)
1. Robot 2 dynamically avoids panels.
2. Robot 1 and 3 preserve approved positions.
3. Play-review area moves upward.
4. Play/pass buttons visible and functional.
5. Tribute, return-tribute, anti-tribute screens.
6. K-level anti-tribute appears only once.
7. No anti-tribute before current deal finishes.
8. Last played cards remain visible.
9. Deal animation lasts 10 seconds.
10. Four real humans complete three networked deals.
11. Reconnection restores identity, seat, hand and room; robots never take real seats.

This is an isolated QA candidate only, not release approval.
