#!/bin/bash
# SessionStart hook (decision 0177): make graphify ready in every session.
# Installs graphify if it is missing (cloud sessions only), then rebuilds the
# code graph in .graphify/. Runs async so the session starts at once, and
# never fails the session.

echo '{"async": true, "asyncTimeout": 300000}'

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  # A fresh cloud checkout has no node_modules, and the npm run tools need Vite.
  [ -d node_modules ] || npm install --no-audit --no-fund >/dev/null 2>&1 || true
  command -v graphify >/dev/null 2>&1 || npm install -g graphifyy >/dev/null 2>&1 || true
fi

if command -v graphify >/dev/null 2>&1; then
  # About 20 s on this repo; code only, no LLM node descriptions.
  graphify update . --no-description >/dev/null 2>&1 || true
fi
exit 0
