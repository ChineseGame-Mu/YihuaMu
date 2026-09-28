# What is this?

升级 is a popular Chinese trick-taking playing card game, also known as tractor, finding friends, fighting for 100 points, 80 points, etc. Rules are available
[here](https://robertying.com/shengji/rules.html). Due to the COVID-19
shelter-in-place, I've been unable to play the this game in person... so
I figured an online version would be worthwhile.

# Usage:

```
cd frontend && yarn build && cd .. && cd backend && cargo run
```

The server is a self-contained static binary and does not terminate TLS. It
listens on 127.0.0.1:3030, and should only be exposed to an external network
behind a proxy that supports both HTTP and WebSocket protocols (only tested
with `nginx`).

## Environment Variables

- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS requests to the `/api/rpc` endpoint (e.g., `"https://example.com,https://app.example.com"`). Set to `"*"` to allow any origin (not recommended for production). If not set, defaults to allowing common localhost origins for development (`http://localhost:3000,http://localhost:3030,http://127.0.0.1:3000,http://127.0.0.1:3030`).

### Guandan victory screenshot email (Vercel frontend)

The frontend's `/api/send-guandan-victory` function sends the PNG victory
result image using Resend. Configure these **server-side Vercel environment
variables** for the frontend project:

- `RESEND_API_KEY`: Resend API key with permission to send email.
- `RESEND_FROM_EMAIL`: sender address on a domain verified in Resend, for
  example `Yihua Games <games@example.com>`.
- `SCREENSHOT_ALLOWED_ORIGINS`: Optional comma-separated additional frontend
  origins. `https://yihuagames.com` is always allowed; Vercel deployments also
  allow their own deployment URL. The retired `yihua-mu.vercel.app` hostname
  is no longer a default production origin.

Players enter the recipient address in Personal Settings, available from the
welcome page and game toolbar. This repository has no sign-in or profile
backend, so the setting is stored in that browser's local storage under the
player's display name and is available across games when the same name is used.
When the match winner is set, the client creates a full-screen PNG victory
result image and posts it to the Vercel function. It displays a sent or failed
status and allows retrying. Without the Resend key and verified sender address,
the function returns an error and the UI does not claim that the email was sent.

### Guandan multiplayer tribute

Four-player tribute keeps its single and double exchange rules. In 6–14 player
tables, a team sweep creates one tribute and one return-card exchange per player
in each half of the finish order. Tribute cards are ranked by card strength;
equal values are resolved by current seat order. The highest tribute giver
opens the next deal.

# Development

```
cd frontend && yarn watch
cd backend && cargo run --features dynamic
```

## Syncing types from Rust to Typescript

There are shared types in the Rust backend and the Typescript frontend; the `frontend/json-schema-bin/src/main.rs` file dumps the Rust types to JSON Schema, and the `yarn types` command will generate the Typescript types.

```
yarn types && yarn prettier --write && yarn lint --fix
```

## Generating JSON
A mapping of card data is generated from the server. It's checked in at
`src/generated/cards.json`. To update it, start up the server and run

```
yarn download-cards-json
```

## Prettier
To format frontend code:

```
# Dry-run/check
yarn prettier --check

# Fix files, will overwrite files
yarn prettier --write
```

## Lint
To run tslint:

```
cd frontend && yarn lint
```

And clippy:
```
cargo clippy
```

## Tests
To run tests:

### Frontend:
```
cd frontend && yarn test
```

### Backend:
```
cargo test
```

# Technical details
The entire state of each game is stored in the memory of the server process.
Restarting the game kicks all players, and games are automatically closed when
all players have disconnected. The bulk of the game logic is implemented in the
server, but players are expected to keep each other in check -- the server does
not validate moves in their entirety.

For simplicity, the game is written in Rust and Javascript, linking in Axum as
the WebSocket/HTTP server implementation and using React from a CDN.

# Known issues
- No mobile support
- Incomplete validity checking for forced-plays
- No player limit per game
- No overall player limit

# Play online!

[https://robertying.com/shengji/](https://robertying.com/shengji/)
