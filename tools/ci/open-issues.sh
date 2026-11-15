#!/usr/bin/env bash
# Lists the issues still open in a milestone, for the release lead to check before tagging.
# Needs GH_TOKEN, GH_REPO; $1 is the milestone title. Prints a markdown list, nothing when clean.
set -euo pipefail

gh issue list --milestone "$1" --state open --limit 200 --json number,title \
  --jq '.[] | "- #\(.number) \(.title)"'
