# QA-only embedded homepage gate (2026-10-17)

Approved homepage: room selector, player name, Enter Room. No start-player-count selector. Preserve 4–14 player functionality in game logic.

## Immutable baseline
- Base commit: `27ee737bfbc155315421c34373d8cc99891f203a`
- QA deployment: `dpl_4a3VtMK5WWyZK37QYwEsuv77Mtxn`
- Production alias `yihua-mu.vercel.app` must remain on `dpl_Drf4s1hQRrKrG1vHapaZmStCh8HS`.

## Required deployment verification before promotion
1. Inspect actual HTML/JS/CSS served by the immutable QA deployment in an authenticated browser, not just GitHub source or READY status.
2. Assert the root page renders the approved `CleanroomEntry` lobby: one room selector, one name input, one Enter Room button; **zero start-player-count controls**.
3. Verify `frontend/src/index.tsx` selects `CleanroomEntry` at `/` and `backend/src/main.rs` embeds the intended `frontend/dist` files.
4. Verify room creation/join and supported 4,6,8,10,12,14 player counts remain functional without a homepage selector.
5. Fail closed on missing browser evidence, stale bundles, or unexpected query-based routing.
6. Do not merge or deploy production until browser acceptance and all other mandatory gates pass.

## Evidence so far
- GitHub source at baseline shows only room/name/Enter Room controls in `CleanroomEntry.tsx`.
- QA deployment metadata and build logs point to the same SHA and report no prior build cache.
- User's QA browser screenshot showed the obsolete player-count selector.
- Deployment file-tree API returned 404; embedded bundle not independently verified.

**Status: BLOCKED / FAIL. This document is an investigation checkpoint, not a passing QA result.**
