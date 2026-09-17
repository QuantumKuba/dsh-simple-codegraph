#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# Publish dsh-simple-codegraph to awesome-dsh-plugin once repository is >= 24h old.

REPO="QuantumKuba/dsh-simple-codegraph"
UPSTREAM="awesome-dsh-plugin/awesome-dsh-plugin"
HEAD_BRANCH="QuantumKuba:add-quantumkuba-dsh-simple-codegraph"
PR_TITLE="Add QuantumKuba/dsh-simple-codegraph (dev)"

LOG_FILE="/Users/kuba/Documents/Github/dsh-simple-codegraph/publish_pr.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== [$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Checking 24h eligibility for $REPO ==="

# Get repo creation date in UTC
CREATED_AT=$(/opt/homebrew/bin/gh repo view "$REPO" --json createdAt -q .createdAt)
echo "Repository created at: $CREATED_AT"

# Calculate ages using python
if ! python3 - <<EOF
import sys
from datetime import datetime, timezone, timedelta

created_str = "$CREATED_AT"
created_dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
now_dt = datetime.now(timezone.utc)
diff = now_dt - created_dt
total_seconds = int(diff.total_seconds())
required_seconds = 24 * 3600

print(f"Current age: {total_seconds}s ({diff})")

if total_seconds < required_seconds:
    remaining = required_seconds - total_seconds
    print(f"Repo is not yet 24 hours old. Remaining: {remaining}s ({timedelta(seconds=remaining)}).")
    sys.exit(1)
else:
    print("Repo is >= 24 hours old. Proceeding with PR submission.")
    sys.exit(0)
EOF
then
    echo "Aborting: repo is not yet 24h old."
    exit 0
fi

# Check if PR already exists
EXISTING_PR=$(/opt/homebrew/bin/gh pr list --repo "$UPSTREAM" --head "$HEAD_BRANCH" --json url -q '.[0].url' 2>/dev/null || true)
if [ -n "$EXISTING_PR" ]; then
    echo "PR already open: $EXISTING_PR"
    exit 0
fi

echo "Submitting Pull Request to $UPSTREAM..."

PR_BODY=$(cat <<'BODY'
- [x] I added one file at `data/plugins/<owner>__<repo>.yml`
- [x] My repo's `package.json` declares `dsh.bundle` (not just `dsh.client`)
- [x] My repo is at least 1 day old
- [x] `category` is one of the supported categories (`dev`)
- [x] Description states what the plugin does, no superlatives
- [x] My repo has the `dsh-plugin` topic

### Summary

Adds `QuantumKuba/dsh-simple-codegraph` under the `dev` category. Per-agent CodeGraph code intelligence integration for DeepSeek Harness: exposes AST exploration without redundant reads, prompt churn, or scope pollution.
BODY
)

NEW_PR=$(/opt/homebrew/bin/gh pr create \
  --repo "$UPSTREAM" \
  --base main \
  --head "$HEAD_BRANCH" \
  --title "$PR_TITLE" \
  --body "$PR_BODY")

echo "Success! PR created: $NEW_PR"
