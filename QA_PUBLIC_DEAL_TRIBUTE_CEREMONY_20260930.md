# Important Guandan public-table ceremony checkpoint — 2026-09-30

## Added

- Every new round now presents a clockwise, one-card-at-a-time deal in the center of the public table.
- The center deck shows the current recipient, cards dealt, and exact cards remaining.
- The public table presents tribute and return-tribute cards as directional player-to-player moves.
- Single tribute names the exact receiving player; double tribute identifies the winning/losing side without claiming an incorrect pairing before card strength resolves it.
- Desktop, mobile, and reduced-motion presentation rules are included.

## Preserved

- Persistent anti-tribute notice
- Four-player double-down immediate round completion
- Robot-first-winner automatic next-round deal
- Current-player-only beep and “请出牌” prompt
- Existing dedicated Guandan lobby and review/private-table layout

## QA

- Frontend Jest: 39 suites / 163 tests passed
- Frontend ESLint: passed
- New deal arithmetic covers 4, 6, 8, 10, 12, and 14 players
- `yihua-game` Vitest: 203 files / 1380 tests passed
- `yihua-game` typecheck and build: passed
- Direct frontend TypeScript reaches only existing dependency/WASM declaration failures; the edited TypeScript was accepted by Jest/ts-jest and ESLint

## Recovery branches

- Before this feature: `backup/pre-public-deal-tribute-ceremony-20260930`
- Important completed checkpoint: `backup/important-guandan-public-deal-tribute-ceremony-20260930`
