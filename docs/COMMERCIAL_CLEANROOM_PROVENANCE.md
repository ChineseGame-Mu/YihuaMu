# Commercial clean-room provenance release gate

Status: **BLOCKED — not approved for commercial release**

This document is a release gate, not a claim of ownership. The final commercial three-game product (Shengji/Tractor, Finding Friends, and Guandan) must use an independently controlled clean-room backend, independently controlled infrastructure, an independently controlled compatibility layer, and frontend/assets whose provenance and license have been reviewed item by item.

## Backend gate

The current repository backend is **not accepted as the final commercial clean-room backend**. In particular, `backend/Cargo.toml` currently identifies the package author as `Robert Ying <rbtying@aeturnalus.com>`. Existing backend implementation files and shared game crates must therefore be treated as provenance-unresolved/original-project implementation unless independently documented otherwise.

Required before commercial release:

- [ ] Produce a behavior/protocol specification from externally observable behavior and separately documented requirements.
- [ ] Implement the commercial backend in an independently controlled clean-room code path without copying provenance-unresolved/original-author backend implementation.
- [ ] Inventory every backend/runtime dependency and confirm its license permits the intended commercial use and distribution.
- [ ] Demonstrate protocol compatibility with the three games through black-box/contract tests.
- [ ] Demonstrate that the Render production path uses only the approved clean-room backend implementation.
- [ ] Remove the provenance-unresolved/original-author backend implementation from the final commercial build/deployment path; retaining it for historical/reference purposes must not make it a production dependency.

## Compatibility-layer gate

- [ ] Maintain an independently controlled compatibility layer and protocol fixtures/specifications.
- [ ] Record each compatibility behavior required by Shengji/Tractor, Finding Friends, and Guandan.
- [ ] Verify reconnect, identity/seat preservation, room rejoin, in-progress state recovery, duplicate/loss handling, abnormal close, timeout, and multi-client synchronization against the clean-room backend.

## Frontend and asset gate

Every production frontend source file, image, icon, font, audio file, generated artifact, translation, rules text, and other shipped asset must be entered in a provenance inventory with: path/item, source/creator, copyright owner where known, license or permission basis, required attribution/notice, and commercial-use decision.

Release remains blocked while any shipped item is marked unknown, unresolved, incompatible, or unreviewed.

- [ ] Frontend source inventory complete.
- [ ] Images/icons inventory complete.
- [ ] Fonts inventory complete.
- [ ] Audio inventory complete.
- [ ] Rules/text/translations inventory complete.
- [ ] Third-party package/license inventory complete.
- [ ] Required attribution/license notices preserved.
- [ ] No unresolved item enters the final production bundle.

## Infrastructure gate

- [ ] Production infrastructure is controlled by the project owner and deploys the approved clean-room artifacts only.
- [ ] The three-game Render deployment is traceable to one exact approved Git commit SHA.
- [ ] The protected historical Vercel site is not a dependency or deployment target of the final commercial system.

## Technical QA gate

Commercial release additionally requires the same exact final SHA to pass all mandatory real QA for all three games: real browser where applicable, 4+ concurrent clients, join/start/in-progress gameplay, consecutive legal actions, synchronization, disconnect, capped exponential-backoff reconnect, same-room/same-identity rejoin, private/public state recovery, repeated reconnect, abnormal close, latency/timeout, controlled message loss/duplicate delivery, and full regression.

No source inspection, unit test, mock, workflow presence, or prior-SHA result substitutes for the required real execution evidence.

## Approval rule

The commercial release gate is green only when every checkbox above is supported by retained evidence and the exact approved SHA is the SHA deployed to the three-game Render production site. Until then, `master` and commercial production release remain blocked.