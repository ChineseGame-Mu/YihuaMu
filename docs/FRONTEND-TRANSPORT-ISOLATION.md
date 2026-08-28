# Frontend Transport Isolation Contract

Status: active clean-room migration contract.

This document records the existing Guandan frontend transport surface that must be satisfied by the independently implemented `yihua-game/**` engine. It documents observable interface requirements only; it is not permission to copy legacy backend implementation.

## Existing frontend transport entry point

The current frontend opens a WebSocket ending in:

- `/api/guandan`

Runtime host selection currently supports a test override, `_WEBSOCKET_HOST`, a Vercel fallback host, and same-origin WebSocket construction.

Clean-room rule: the commercial frontend must ultimately point this transport to the independently implemented clean-room service. The legacy backend must not be required at runtime.

## Client-to-server compatibility surface

The current frontend protocol declares these message families:

- `join`
- `reorder_players`
- `set_participation`
- `set_bots`
- `start`
- `shuffle_next_round`
- `deal_next_round`
- `play`
- `tribute_card`
- `return_tribute`
- `pass`
- `end_round`

Clean-room product rule: robots/bots are not part of the target product. Any legacy `set_bots` compatibility behavior must not create a production dependency on legacy bot implementation.

## Server-to-client compatibility surface

The current frontend consumes these message families:

- `connected`
- `joined`
- `waiting`
- `started`
- `hand`
- `state`
- `error`

The public `state` contract includes player/observer presence, turn, hand counts, current/previous plays, table play history, pass/trick state, initial draw, level/team progress, finish order, winner/promotion information, tribute state, match winner, and next-round phase.

## Isolation requirements

1. Implement `/api/guandan` in `yihua-game/**` or an independently authored clean-room deployment adapter.
2. Translate the existing frontend message shapes at the clean-room boundary rather than importing legacy Rust/backend code.
3. Preserve the existing frontend UI while changing only the transport/backend binding needed for migration.
4. Add contract tests for every supported client command and server event.
5. Add stable session identity/reconnect behavior so reconnecting does not allocate a duplicate player seat.
6. Support production player counts 4, 6, 8, 10, 12, and 14, with late human participants waiting/entering only according to clean-room room rules.
7. Prove by build/deployment checks that the commercial clean-room runtime does not compile, import, start, proxy to, or otherwise require `backend/**`.

## Provenance classification

- `frontend/src/GuandanWebsocketProvider.tsx`: existing frontend; provenance audit required before exclusive-ownership claim.
- `frontend/src/guandanProtocol.ts`: existing frontend protocol declaration; provenance audit required before exclusive-ownership claim.
- `yihua-game/**` compatibility implementation: clean-room implementation area, subject to final code/provenance audit.
- `backend/**`: legacy/original-project isolation area; excluded from clean-room commercial runtime.

## Immediate engineering target

Create and test a real clean-room `/api/guandan` WebSocket endpoint that accepts the existing frontend's observable message contract and emits the frontend's expected public/private state without executing legacy backend implementation.
