# Security Policy

## Reporting a vulnerability

Do not disclose exploitable details in a public issue. Send a private report to
`muyihua@gmail.com` with the affected URL or component, reproduction steps, and
the observed impact. Remove access tokens, passwords, private player data, and
other secrets from screenshots and logs before sending them.

The maintainers will acknowledge a report, validate it, prepare a fix, run the
mandatory three-pass QA gate, and deploy only after the fix passes review.

## Supported deployment

Security fixes are applied to the production clean-room branch
`cleanroom/yihua-game-20260826` and the services deployed from it. Older backup
branches are retained for recovery and are not independently supported.

## Operational rules

- Never commit `.env` files, private keys, service tokens, or production logs.
- Rotate a credential immediately if it is exposed.
- Keep Vercel and Render access limited to maintainers who need deployment
  access, with multifactor authentication enabled on the provider accounts.
- Introduce firewall blocks in log-only mode first, then validate them against
  real multiplayer traffic before enforcement.
