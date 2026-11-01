# What the workflows do (decision 0224)

Threads: do not repeat these by hand. Tools live in `tools/ci/`, limits in data files.

| Workflow (check name) | Runs on | What you get |
|---|---|---|
| `CI and GitHub Pages` (`build`) | every PR touching code, main | lint, tests, build, Pages deploy |
| `PR rules` (`rules`) | every PR | fails on: a code file over 400 lines that grew (docs are exempt), JSON over 200 KB, an image over 500 KB or 1920 px, no "Fixes #N". Limits: `.github/rules.json` |
| `Render budget` (`budget`) | PRs touching `src/` | headless sailing and docking run; fails if draw calls or triangles pass `tools/performance/budget.json`. Raise it in your PR with the reason; frame times still need `?bench` on a device |
| `Screenshot sheet` (`sheet`) | Guillaume's PRs touching the game | one JPG comment: sea day (desktop, phone), night, Saltmere market (desktop, phone), chart. Views: `tools/ci/sheet.json`. Look at it once; take your own shots only for something it does not show |
| `CI summary` | after the three above | a comment with only the failing lines, updated in place, "green" when fixed. Read it instead of the log |
| `Auto-merge` (`arm`) | label `automerge`, or Guillaume's approval | arms GitHub auto-merge. Only for branches in this repo whose PR author is djguiaume; never forks. A PR labelled `visual` also needs the `visual-ok` label or his approval: **never add `visual-ok` yourself**, only after Guillaume has seen the shots |
| `Issue triage` | new issues | "bug:" / "idea:" titles get the label; bug/idea issues without a milestone get the next one (`.github/triage.json`) |
| `Prepare release` | run by hand | PR setting `package.json` to the release number (the menu shows `<major>.<minor>.<merges>`) |
| `GitHub release` | run by hand or tag | uses `docs/releases/<tag>.md`, or drafts notes from the closed issues of the `milestone` input |
| `Graphify` | push to main | rebuilds the graph as an artifact (checks it still builds); still run `graphify update .` yourself |

## Setup only Guillaume can do

- Settings > General > Pull requests: **Allow auto-merge**, and **Allow GitHub Actions to create and approve pull requests** (for `Prepare release`).
- Branch protection on `main`: require a pull request, require status checks `build` (and optionally `rules`, `budget`), no approvals needed, don't bypass for admins is optional.
- Secret `AUTOMERGE_TOKEN`: a fine-grained token (Contents and Pull requests: read and write, this repo only). Without it auto-merge works, but a merge made with the default token does not start the Pages deploy; run `CI and GitHub Pages` from the Actions tab then.

## Security rules for these workflows

No `pull_request_target`, no `workflow_run` that checks out PR code, no PR title, body or branch name inside a shell line (pass it through `env`), least-privilege `permissions`, and every write path checks that the PR is from this repo and by djguiaume.
