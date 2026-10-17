# Noon safe integration QA gate — 2026-10-17

Integration base: PR #90, SHA 25ed25b5fdd2c8d4a8cfe8e4d8cb89cc658c1358. Robot source: PR #89, SHA 66041751368ca5a8b9591b77728369816173d5b5.

DO NOT deploy or merge the divergent PR #89 branch directly. Protect approved homepage files CleanroomEntry.tsx Git blob 043b563fb4c85dd6609400068dccb402c7caed41 and cleanroom-lobby-artwork.css Git blob b1f1e463710ede481c24f12903ad0ae3beb5d7e4. Do not touch three-game Render.

## Integration gates (all mandatory)
- [ ] Selectively port robot strategy changes from backend/src/guandan_handler.rs and resolve 409 changed-line divergence, without overwriting PR #90 tribute/reconnect changes.
- [ ] Test leading and responding with straight, consecutive pairs, and three-with-two, with legal classification and hand state checks.
- [ ] Test bomb conservation, teammate cooperation, opponent one-card emergency, level-card/joker preservation, and deterministic endgame.
- [ ] Test King-level anti-tribute popup exactly once, never before previous trick ends; dedicated Rust step must run, not skip.
- [ ] Confirm all 11 requested UI and gameplay items with actual browser evidence, including 10-second deal and responsive robot 2 panel avoidance.
- [ ] Run four independent real network clients for three full games and reconnect/reclaim tests; robot simulation is insufficient.
- [ ] Validate durable room-state export, full runtime backup, and actual restoration drill.
- [ ] Confirm approved homepage Git blobs unchanged and same SHA CI, preview and acceptance results.

Evidence before integration: PR #90 CI #39028586695 SUCCESS, preview dpl_Dzwxo7qwwcXP8PTkPTpbmEdkMqhr READY but SSO prevents browser acceptance. PR #89 CI passed independently; not integrated. Until every gate passes, production yihua-mu.vercel.app remains at SHA 3031e1a2375bb9870b409a17cb240af42cae435c.
