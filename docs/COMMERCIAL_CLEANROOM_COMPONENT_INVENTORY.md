# Commercial Clean-room Component Inventory

Status: **BLOCKED — release inventory in progress**

This inventory is a technical/provenance release gate. It is not a legal ownership opinion. Unknown or unresolved items remain blocked until documented and reviewed.

## Backend/runtime components

| Component | Candidate production path | Current provenance evidence | Commercial status |
| --- | --- | --- | --- |
| Guandan clean-room server/game core | `commercial-cleanroom/guandan/src/` | Migrated from the independently developed `yihua-game/` clean-room subtree; repository history and project notices provide supporting provenance evidence | **Candidate / QA required** |
| Guandan clean-room tests/scripts | `commercial-cleanroom/guandan/test/`, `commercial-cleanroom/guandan/scripts/` | Same isolated clean-room subtree | **Candidate / QA required** |
| Original repository Rust backend | `backend/` and original shared backend crates | Originates from the upstream/original project and is not independently cleared for the commercial clean-room target | **EXCLUDED from final commercial production path** |
| Shengji/Tractor commercial backend | TBD clean-room path | Independent implementation not yet completed | **BLOCKED** |
| Finding Friends commercial backend | TBD clean-room path | Independent implementation not yet completed | **BLOCKED** |
| Compatibility/protocol adapter | TBD clean-room path | Must be independently authored from documented/observable protocol behavior | **BLOCKED** |

## Guandan direct npm dependency inventory

Source of record: `commercial-cleanroom/guandan/package-lock.json` / `package.json` on the release SHA.

The release gate must record package name, exact locked version, license identifier, source URL, security advisory status, and whether the package ships at runtime or is development-only. The current GitHub Actions install reports **2 moderate severity vulnerabilities**, so dependency security review is **not yet green**.

No package is considered commercially cleared merely because `npm ci` succeeds.

## Frontend and asset inventory

The current repository frontend and all production-visible assets remain **unresolved for commercial release** until item-by-item review. The inventory must cover at minimum:

- frontend source files and independently authored compatibility code;
- card images, icons, logos, backgrounds, fonts, audio and animation assets;
- translations and other bundled text/content;
- third-party JavaScript/CSS/runtime packages and exact licenses;
- required attribution/NOTICE text and redistribution conditions.

Each item must be marked one of: `OWNED`, `PERMISSIVE-LICENSE-REVIEWED`, `REPLACED`, or `BLOCKED`. Unknown provenance is `BLOCKED`.

## Mandatory release conditions

Commercial release remains blocked until all of the following are true on one exact final SHA:

1. Original-author backend code is absent from the production runtime/build path.
2. Clean-room backend implementations cover Shengji/Tractor, Finding Friends and Guandan.
3. The compatibility layer is independently authored from documented/observable behavior.
4. Backend/runtime dependency licenses and security advisories are reviewed and resolved.
5. Frontend/assets are inventoried item-by-item with no unresolved shipped item.
6. Mandatory real QA passes for all three games, including 4+ concurrent clients, reconnect/state recovery, fault handling and full regression.
7. Render production is verified against the approved exact SHA.
8. The protected Vercel site remains unchanged and is not a production dependency of the commercial three-game system.
