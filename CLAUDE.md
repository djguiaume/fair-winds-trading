# Working on Fair Winds Trading

Rules and pointers only. History lives in `docs/decisions/`, `docs/releases/` and the plans.

## Start here

- Build thread: read your GitHub issue (goal, files, done when), not the whole plan or chat history. Your PR says "Fixes #N".
- Roles (release lead, build threads, storyteller, art director): [docs/roles.md](docs/roles.md).
- Current release plan: `docs/v1.1/plan.md` (next: `docs/v1.2/plan.md`). Roadmap: `docs/roadmap.md`.
- Look rules: `docs/art/art-bible.md` (decision 0165). Story rules: `docs/story/storyteller-brief.md` (decision 0129).

## Graphify (decision 0177) — do this first on code work

Threads keep forgetting it. Before reading or grepping code: run `graphify update .`, then `graphify query "<question>"`, `graphify explain <node>` or `graphify path <a> <b>`. Re-run `graphify update .` after big changes. Use it on any code work, big or small. Skip it only for docs and plans. Missing? `npm install -g graphifyy`.

## Quality goals

- Human readable, clear code: small functions, clear names, comments only for the why. Match the surrounding code.
- Best practices: TypeScript strict, no dead code, no copy-paste (move shared logic into a module), Vitest tests for logic.
- Keep it optimized: it must run on an old tablet and a phone (decision 0006); no per-frame allocations, watch draw calls and triangle budgets (`?perf`, `?bench`).
- No big files: split a file once it passes about 400 lines. Same for docs: one subject per file, short.
- Everything data driven (decision 0093): tuning numbers and content (goods, ships, towns, weather, quests, text) live in data files, never in TypeScript constants.
- Every authoring feature is editable in the editors AND has a matching `npm run` tool (decision 0153); the tool and the editor share one module.

## Rules

- Everything lives in this repo: code, assets, plans and decisions. Always document.
- Record each decision with `npm run adr -- new "Title"` (context, decision, consequences); it adds the README line.
- Keep `docs/roadmap.md` up to date when scope or phases change.
- Quests use the quest engine; split long dialogue into several cards.
- Balance and timings are checked on all three difficulty levels (`npm run balance`).
- Hazards and annoyances (night, storms, any new one) can be switched off in Settings.
- Guillaume sees every visual change (screenshots, chart) before it is validated or merged.
- Threads may merge their own PRs when there are no open questions, CI is green and the branch is current with main.
- Never spend paid credits without asking Guillaume first with a cost estimate.

## Saving tokens

- Graphify (see above) is the first token saver on code work.
- Read only the files you need. Use the tools below instead of one-off scripts; prefer `--json`, `tail` and quiet test reporters.
- Run `npm run check` after editing data files, then only the tests you touched before the full `npm test`.
- Screenshots: as few as needed, JPG, at most ~1280 px wide, desktop (plus phone when the layout changes). Look at each image once.
- Wait for CI with a PR subscription, not polling.
- Workflows do the chores (decision 0224, [docs/tools/ci.md](docs/tools/ci.md)): a screenshot sheet on game PRs, a short failing-lines comment on red CI, rule checks (400 lines, big JSON and images, "Fixes #N"), a render budget, issue triage. Read their comments; don't repeat them by hand.
- Auto-merge: add the `automerge` label when your PR is ready. A visual PR waits for Guillaume's `visual-ok`; never add that yourself.

## Command-line tools (decision 0153)

Full options: [docs/tools/README.md](docs/tools/README.md), or `--help`. `npm run fw` lists them.

- `check`: every editor content check (~10 s).
- `adr`: next free decision number across all branches; `adr -- new "Title"`.
- `balance`: balance bots on all three levels.
- `island`: make and edit island files with the builder's edits.
- `sea`: edit the sea files with the sea editor's edits; `sea -- density`.
- `chart`: labelled map PNG/SVG for any map or layout change.
- `shots`: real-game screenshots in one line (also the map editor, save links).
- `quest`: list, check, play from a step, edit a quest's sea.
- `race`: regatta courses, pars and rules.
- `sound`: render the game's sounds to MP3.

If a tool lacks something, add it to the tool (and its shared module) rather than writing a script.
