# Roles

Who decides what in a release, and how threads talk to each other. Guillaume set these rules on 2026-10-28 to cut token use. Guillaume gives the final OK on goals, prices that change progression, and every visual.

## Release lead

- Writes one brief per release in `docs/vX.Y/plan.md`, then creates the GitHub milestone (e.g. "v1.1 The Sailing Club") and one issue per part: goal, files to touch, "done when", effort, visual yes/no. Bug fixes can share one checklist issue; a big bug gets its own.
- Runs at most 3 to 5 build threads at a time, one per issue, never two on the same files.
- New bugs and ideas from playtests become short issues (label `bug` or `idea`) for the next release, unless Guillaume says fix now.
- Does the release itself (version, `docs/releases/`, decision) and resolves the role threads when it ships.

## Build threads

- One thread per issue. Start from the issue, not the plan or chat history. The PR says "Fixes #N".
- Answer small story and look questions yourself from [the story brief](story/storyteller-brief.md) and [the art bible](art/art-bible.md).
- Ask the storyteller or art director only for a real decision (new person, new rule, a look the bible does not cover, a price that changes story progression). Put all questions in one message. Ask the storyteller before Guillaume.
- Visual work: one combined review round, screenshots to the art director and Guillaume together.
- Follow the quality goals in [CLAUDE.md](../CLAUDE.md) (readable, optimized, no big files, data driven, editor plus CLI) and run graphify first on code work.
- Merge your own PR when there are no open questions, CI is green and it is current with main. Resolve the thread when done.

## Storyteller

- Decides voice, people, quest text and order, and where prices fit the story. Writes it in [docs/story/storyteller-brief.md](story/storyteller-brief.md), in the same PR as the ruling.
- Does not ask Guillaume small questions; merges its own story PRs once all questions are answered.

## Art director

- Decides the look and keeps the game coherent. Writes the rules in [docs/art/art-bible.md](art/art-bible.md) (decision 0165).
- Its OK means "ready to show Guillaume", never "merged". Its own PRs are docs only.

## Lifetime and handover

- Storyteller and art director threads live for one release. They start from their handover file and resolve when the release ships.
- Before resolving, each writes `docs/<role>/handover.md` (`docs/story/`, `docs/art/`), about one page:
  1. **Open decisions**: what is undecided and who is waiting on it.
  2. **Pointers**: the brief or bible sections, decisions and data files that matter now.
  3. **Follow-ups**: small agreed work not yet done, each with its issue.
- No history: what happened is in the decisions, PRs and release notes. The next thread replaces the file rather than appending.
- Earlier examples: [story handover](story/handover-phase5.md), [art handover](art/handover.md).

## Each decision lives in one place

Look rules in the art bible, story rules in the story brief, everything else in a decision (`docs/decisions/`). Issues hold the "what", plans and decisions the "why". Memory and CLAUDE.md only point to them.

More ways to save tokens: [token-saving.md](token-saving.md).
