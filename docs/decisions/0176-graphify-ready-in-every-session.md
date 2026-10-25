# 0176. Graphify ready in every session

**Status:** Accepted (2026-10-25): Guillaume asked for the rule in `CLAUDE.md` and a startup hook.

## Context

Guillaume wants every agent thread to use [graphify](https://www.npmjs.com/package/graphifyy) (a code knowledge graph) before grepping or reading many files, because it saves tokens. The rule lived only in project memory and in the instructions handed to each thread. A thread reads those once, so after a long run or a summary it forgot the rule. Cloud sessions also start from a fresh checkout with no `node_modules`, so the `npm run` tools (0153) failed until someone ran `npm install`.

## Decision

- **`CLAUDE.md`** opens with a short graphify section: run `graphify update .` first, use `graphify query` / `graphify explain` before grepping or reading many files, re-run after big changes, install it if missing (`npm install -g graphifyy`, binary `/opt/node22/bin/graphify`). Claude Code reloads `CLAUDE.md` in every session, also after a summary.
- **A SessionStart hook**, `.claude/hooks/session-start.sh`, registered in `.claude/settings.json`. In cloud sessions (`CLAUDE_CODE_REMOTE=true`) it runs `npm install` when `node_modules` is missing and installs graphify when it is missing. Everywhere it then runs `graphify update . --no-description` (code only, about 20 s). It runs async, so the session starts at once, and it always exits 0, so it never blocks or fails a session.
- `.graphify/` (the graph and its state) stays out of git, as before: it is rebuilt per checkout.

## Consequences

- Every session has a fresh graph a few seconds after it starts, and the rule is always in view.
- The `npm run` tools work straight away in cloud sessions.
- A query in the first ~20 s of a session may hit the previous graph or none; run `graphify update .` by hand if it reports no graph.
- On a local machine the hook only rebuilds the graph when graphify is already installed; it installs nothing there.
