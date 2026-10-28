# 0224. GitHub Actions do the repeated thread chores

**Status:** Accepted (2026-10-28).

## Context

Threads kept spending tokens on chores that are the same every time: taking, resizing and checking screenshots, reading long CI logs, checking main before a merge, counting file lines, writing release notes. The repo is public, so anything that merges or comments must not trust forks.

## Decision

Free workflows in `.github/workflows` do these chores; the logic lives in `tools/ci/` and `tools/performance/` as small tested scripts and the limits in data files (`.github/rules.json`, `.github/triage.json`, `tools/performance/budget.json`). Details: [docs/tools/ci.md](../tools/ci.md).

- Screenshot sheet on PRs that touch the game (`npm run shots` list in `tools/ci/sheet.json`).
- A short comment with only the failing lines when CI, the rule checks or the render budget fail.
- Auto-merge is armed only for PRs from a branch in this repo whose author is djguiaume, by his `automerge` label or approval; a `visual` PR also needs `visual-ok` or his approval. No `pull_request_target`, no PR code run with write rights, no PR text in a shell.
- Rule checks (files over 400 lines that grew, big JSON, oversized images, "Fixes #N"), a render budget (draw calls and triangles), release notes drafted from the milestone, a "Prepare release" PR for the version, a graphify rebuild on main, and bug/idea issues sorted into the next milestone.

## Consequences

- Threads read one short comment instead of logs and images, and no longer check main before merging.
- Branch protection (Guillaume's setting) is what actually stops a merge; auto-merge only waits for it.
- A merge made with `GITHUB_TOKEN` does not start the Pages deploy, so the `AUTOMERGE_TOKEN` secret (a fine-grained token of Guillaume's) is recommended.
- Budgets and limits are data: a PR that needs more raises them with its reason.
