# IP Isolation Inventory

Status: active clean-room isolation work.

This document records provenance boundaries for the commercial clean-room line. It is an engineering inventory, not a legal opinion.

## A. Clean-room owned implementation area

Primary implementation namespace:

- `yihua-game/**`

Clean-room CI/infrastructure:

- `.github/workflows/cleanroom-yihua-game.yml`
- `.github/workflows/cleanroom-yihua-game-soak.yml`
- `.github/workflows/cleanroom-autoformat-once.yml`

Policy:

- New engine, room/session management, WebSocket/API compatibility layer, tests, recovery logic, soak tests, and future deployment infrastructure are implemented here.
- Do not copy implementation code from the legacy backend into this area.
- Installed dependency trees (`node_modules`), build output, and coverage output are excluded from source control.

## B. Legacy/original-project area — isolation boundary

The following paths exist in the inherited/fork repository and are not part of the clean-room engine ownership claim unless separately proven:

- `backend/**`
- root Rust workspace files such as `Cargo.toml`, `Cargo.lock`
- `.github/workflows/ci-workflow.yaml`
- other pre-existing legacy workflows not named `cleanroom-*`
- root `LICENSE` and other inherited project metadata

Policy:

- Do not modify these files as part of clean-room engine development.
- Do not ship legacy backend implementation as part of a future clean-room commercial engine package.
- Legacy files may remain in the historical fork during migration, but must be excluded from the final isolated commercial source package unless their provenance and license treatment are deliberately accepted.

## C. Existing frontend — provenance audit required

The existing `frontend/**` is being preserved for product continuity, but its provenance must be audited file-by-file before any claim that the complete commercial product is exclusively owned.

For each frontend source/assets file classify as one of:

1. independently authored/owned;
2. third-party dependency or asset with documented license;
3. inherited/original-project material requiring replacement or license compliance;
4. uncertain — quarantine until resolved.

No frontend file should be marked exclusively owned merely because it is connected to the clean-room engine.

## D. Third-party software boundary

Third-party packages are build/runtime dependencies, not owned source code. Record package name, version, license, source and distribution obligations before commercial release.

`yihua-game/node_modules/` must never be committed. Reproducible installs come from package manifests/lockfiles.

## E. Release gate for an isolated commercial codebase

Before labeling a release as a clean-room commercial baseline, all of the following must be true:

- legacy backend is not compiled, imported, packaged, deployed, or required at runtime;
- legacy CI files are not required by the commercial build;
- clean-room CI can build/test the product independently;
- frontend provenance audit has no unresolved inherited implementation files;
- third-party license inventory is complete;
- visual/audio/font/card assets have documented provenance;
- production deployment uses only approved clean-room and documented third-party components;
- a final repository/path manifest records exactly what is included in the commercial release.

## Current red lines

- Never modify `master` for isolation work.
- Never move or rewrite the known green soak-test backup branch.
- Never modify `.github/workflows/ci-workflow.yaml` for clean-room needs.
- Never add new dependencies on `backend/**` from `yihua-game/**`.
- Never commit `yihua-game/node_modules/`.

## Next audit work

1. Generate a complete path-level inventory of `frontend/**`.
2. Identify imports/calls from the existing frontend into legacy backend-generated or legacy transport interfaces.
3. Replace those runtime dependencies through the clean-room compatibility adapter/API.
4. Inventory package licenses from `yihua-game/package.json` and lockfile.
5. Inventory all product assets (images, card art, fonts, audio) and record provenance.
6. Produce a final commercial-release allowlist and legacy denylist.
