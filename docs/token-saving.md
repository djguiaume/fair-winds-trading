# Saving tokens on this project

Every way we know to spend fewer tokens, biggest first. The standing rules are in the project instructions and [roles.md](roles.md); this page adds the rest. "Guillaume" marks a step only Guillaume can take.

## What every thread loads on every turn

These cost on every turn of every thread, so shrinking them pays the most.

1. **CLAUDE.md**: rules and pointers only, about 3 KB; tool options live in [tools/README.md](tools/README.md).
2. **Memory index**: under 3 KB, rules and pointers only. About 90 topic files sit behind it and get pulled into threads when they look relevant, so stale ones (finished phases, merged features already in decisions) should be deleted or merged.
3. **Project files list**: every file in the shared folder is listed at the start of every thread (about 300 MB of old review images today). Guillaume: archive or delete old review folders (`art/`, `art-director/`, `east-story/`, `graphics-desktop/` …) once their PRs are merged; the repo keeps what matters.
4. **Project instructions**: keep them to rules; detail goes in the repo.

## Big docs threads read

5. Read one section, not the whole file. `docs/story/storyteller-brief.md` (~46 KB) and `docs/art/art-bible.md` (~22 KB) are the largest; use `grep -n "^#"` to find the section, then read that range. A later step: split the brief into one file per sea or topic with a short index.
6. Don't read data files whole (quests, seas, i18n): use the `npm run` tools, `jq` or `grep`.

## Choosing the model and effort

7. Docs, issues, plans, release notes, screenshot runs: Sonnet (or Haiku for pure lookups) at low effort. Engine and rendering work: Opus at high effort. Guillaume: say which when starting a release, so the lead can set it per thread.
8. No subagents, workflows or deep research unless asked.

## Threads and wakes

9. Each wake re-sends the thread's context, so long threads get expensive per turn. One thread per issue, resolve it when done, and start a new thread with a short handover rather than piling a new ask on a long one.
10. Auto-merge: Guillaume turns on "Allow auto-merge" and branch protection; threads add the `automerge` label (the `Auto-merge` workflow arms it, only for his own branches) instead of waking on each CI event to merge by hand. Setup: [tools/ci.md](tools/ci.md).
11. Docs-only PRs could skip the full build and tests in CI (a `paths-ignore` for `docs/**` with a light check), so they finish sooner and wake threads less. Needs care: Pages deploys from the same workflow.
12. Feedback in one message: when reviewing, put every comment for a thread in one message, so it does one round of work instead of several.

## Images

13. A workflow posts one screenshot sheet on game PRs (desktop and phone, day, night, port, chart), so look at that first. Each image is roughly 1,000 to 1,600 tokens. Take the fewest shots that answer the question, JPG at most ~1280 px, desktop only unless the layout changes. For comparisons, one contact sheet (several views in one image) beats several images. Look at each image once.

## Tool output

14. Failed CI posts a comment with only the failing lines (`CI summary`): read it instead of the log. Prefer `--json` and one-line results; run only the tests you touched (`npx vitest run path --reporter=dot`) before the full suite once; `tail` long logs. Tools should print one summary line by default.

## Up front

15. Ask for references, examples and "done when" before building mockups. Offer 2 or 3 variants, not more.
16. Graphify first on any code work (`graphify update .`, then `graphify query`): a graph answer costs far less than reading files. It is installed in the environment, but threads forget it, so CLAUDE.md puts it at the top. Use it on any code work, big or small; skip it only for docs and plans.
17. Quality goals (CLAUDE.md) also save tokens: files under ~400 lines are cheap to read, data-driven content means changing a JSON file instead of code, and the editor-plus-CLI rule avoids one-off scripts.
