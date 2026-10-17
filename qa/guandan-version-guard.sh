#!/usr/bin/env bash
set -euo pipefail
PROD_URL="https://yihua-mu.vercel.app/"
APPROVED_ENTRY="043b563fb4c85dd6609400068dccb402c7caed41"
APPROVED_CSS="b1f1e463710ede481c24f12903ad0ae3beb5d7e4"
APPROVED_PRODUCTION_SHA="3031e1a2375bb9870b409a17cb240af42cae435c"
APPROVED_DEPLOYMENT="dpl_Drf4s1hQRrKrG1vHapaZmStCh8HS"
mkdir -p qa-artifacts/guard
git fetch --no-tags origin "+refs/heads/qa/robot-ui-safe-integration-20261017-noon:refs/remotes/origin/qa/robot-ui-safe-integration-20261017-noon"
HEAD_SHA="$(git rev-parse HEAD)"
BRANCH_SHA="$(git rev-parse origin/qa/robot-ui-safe-integration-20261017-noon)"
[[ "$HEAD_SHA" == "$BRANCH_SHA" ]] || { echo "::error::Stale workflow commit: current QA head is $BRANCH_SHA"; exit 1; }
[[ "$(git rev-parse HEAD:frontend/src/CleanroomEntry.tsx)" == "$APPROVED_ENTRY" ]] || { echo "::error::Approved lobby component modified"; exit 1; }
[[ "$(git rev-parse HEAD:frontend/src/cleanroom-lobby-artwork.css)" == "$APPROVED_CSS" ]] || { echo "::error::Approved lobby stylesheet modified"; exit 1; }
STATUS="$(curl -L -sS -o qa-artifacts/guard/production-response.html -w '%{http_code}' --max-time 25 "$PROD_URL" || true)"
[[ "$STATUS" == "200" ]] || { echo "::error::Production URL HTTP status: $STATUS"; exit 1; }
PRODUCTION_CHECK="http-200-only"
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  curl -fsS --max-time 25 -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v13/deployments/$APPROVED_DEPLOYMENT" > qa-artifacts/guard/production-deployment.json
  python3 - <<'PY'
import json
p=json.load(open("qa-artifacts/guard/production-deployment.json"))
d=p.get("deployment",p)
sha=d.get("meta",{}).get("githubCommitSha")
assert sha=="3031e1a2375bb9870b409a17cb240af42cae435c", f"Unexpected production SHA: {sha}"
print("Approved production deployment SHA confirmed")
PY
  PRODUCTION_CHECK="deployment-sha-verified"
else
  echo "::warning::VERCEL_TOKEN missing: production identity UNVERIFIED; no production approval possible"
fi
cat > qa-artifacts/guard/manifest.json <<EOF
{"qa_head":"$HEAD_SHA","approved_homepage_entry_blob":"$APPROVED_ENTRY","approved_homepage_css_blob":"$APPROVED_CSS","approved_production_sha":"$APPROVED_PRODUCTION_SHA","approved_production_deployment":"$APPROVED_DEPLOYMENT","production_http_status":"$STATUS","production_identity_check":"$PRODUCTION_CHECK","checked_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
git bundle create qa-artifacts/guard/qa-branch-backup.bundle HEAD
if [[ "${CREATE_BACKUP_TAG:-false}" == "true" ]]; then
  TAG="backup/guandan-qa-$(date -u +%Y%m%dT%H%M%SZ)-${HEAD_SHA:0:12}"
  git config user.name "Guandan QA Backup Bot"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git tag -a "$TAG" -m "QA recovery checkpoint $HEAD_SHA; approved production $APPROVED_DEPLOYMENT"
  git push origin "refs/tags/$TAG"
  echo "Recovery tag: $TAG"
fi
echo "Guard complete: QA $HEAD_SHA, production $PRODUCTION_CHECK"
