#!/usr/bin/env bash
# Gives a new bug or idea issue its label and the next milestone (.github/triage.json).
# Needs GH_TOKEN, GH_REPO, NUMBER, TITLE, LABELS, HAS_MILESTONE.
set -euo pipefail

kind=""
for k in $(jq -r '.labels[]' .github/triage.json); do
  if [[ " $LABELS " == *" $k "* ]] || [[ "${TITLE,,}" == "$k:"* ]]; then kind=$k; break; fi
done
[ -n "$kind" ] || exit 0

gh label create "$kind" --color ededed 2>/dev/null || true
gh issue edit "$NUMBER" --add-label "$kind"

[ "$HAS_MILESTONE" = true ] && exit 0
prefix=$(jq -r '.nextMilestone' .github/triage.json)
milestone=$(gh api "repos/${GH_REPO}/milestones" --jq \
  "[.[] | select(.title | startswith(\"${prefix}\"))][0].title // empty")
if [ -n "$milestone" ]; then gh issue edit "$NUMBER" --milestone "$milestone"; fi
