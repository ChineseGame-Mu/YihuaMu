# Important Guandan recovery checkpoint — 2026-09-30

This checkpoint integrates the four post-recovery categories and the robot-first-winner next-round fix on top of the restored dedicated Guandan lobby.

## Preserved behavior

- Dedicated Guandan lobby and legacy entry path
- Persistent anti-tribute notice
- Four-player double-down immediate round completion
- Current-player-only sound and “请出牌” prompt
- Existing hand-group controls and layout

## Integrated categories

1. Guandan rules, robot strategy, match settlement, and winner screenshot email flow
2. Production-domain source correction for winner email links
3. Production short-link validation migration
4. Live room-status API while preserving the legacy entry link

## Robot winner fix

When a robot is the first-place winner, stale round-boundary state is cleared and the next deal starts automatically without requiring a human to click the dealer/start control. Reconnect recovery also advances this transition.

## QA result

- `yihua-game`: 203 test files / 1380 tests passed
- TypeScript typecheck passed
- Server build passed
- Network start, gameplay transport, restart recovery, and three-cycle crash recovery smoke tests passed
- Frontend: 37 suites / 158 tests and lint passed before the final visible-room email payload correction; the final rerun is blocked locally by an incomplete/corrupted dependency cache, not by a source-test failure
- Rust and WASM verification require CI because this workspace does not contain `cargo`, `rustc`, or `wasm-pack`

## Recovery refs

- Pre-change backup: `backup/pre-four-category-robot-first-winner-20260930`
- Integration commit: `19b6eebf`
- Final QA backup: `backup/important-guandan-four-categories-robot-first-winner-qa-20260930`
