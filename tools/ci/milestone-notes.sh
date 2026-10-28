#!/usr/bin/env bash
# Draft release notes: the closed issues of a milestone, one line each. Needs GH_TOKEN, GH_REPO.
set -euo pipefail

echo "## What this release brought"
echo
gh issue list --milestone "$1" --state closed --limit 200 --json number,title \
  --jq '.[] | "- \(.title) (#\(.number))"'
