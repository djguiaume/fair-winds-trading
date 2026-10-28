# 0234. Terrain command-line tool: sculpt commands, export/import and limits

**Status:** Proposed (2026-10-28).

## Context

[0232](0232-sculpted-terrain-saved-edits-replayed-over-the-height-field.md) built the sculpting core; issue #272 gives every terrain operation to `npm run island` ([0153](0153-command-line-tools-for-agents.md)) with the same code and saved data as the island builder's brushes.

## Decision

- **One module, no second brush:** `src/sim/sculptScript.ts` runs sculpt commands as data (`{ do: 'sculpt' | 'unsculpt' | 'sculpt-import', … }`) through `SculptSession`, the same `begin`, `dab`, `commit` the builder's pointer calls. The same ordered strokes therefore save the same edits and replay to the same ground; a test drives both, with a cancelled drag and an undo and redo between.
- **Commands:** `npm run island -- <id> sculpt raise|lower|flatten|smooth|slope …`, `list`, `remove <n>`, `reset`, `export [--to file]`, `import <file> [--append]`; the same as steps (`--steps`) after the file's other steps. Places are island-radius units in the file's frame (x right, z toward the harbour), heights in world units, as in 0232. `--brush` is the brush radius, because `--radius` already sets the map radius the checks run at. `--override` is the terrace protection control; the island check then wants every building still level.
- **Export and import:** `export` prints (or writes with `--to`) the file's `sculpt` as one line of JSON; `import` takes that, or a whole island file, and replaces the edits (`--append` adds). `parseSculpt` keeps only known fields, so equal terrain is equal JSON.
- **Rejected input, with the reason:** a version other than this game's, a missing edits list, an unknown operation, non-finite or missing numbers, a radius, point count, distance from the island's centre or edit count above `terrain.json › sculpt › limits` (editable in `?tune`). The limits sit in `sculptProblems`, so `npm run check`, the builder's checks and import all enforce them. A command that fails changes nothing.
- **Frame:** `sculptFrame` builds the island frame once for the checks and the tool.

## Consequences

- The builder (#271) can use `parseSculpt` and the limits for its own import and export buttons.
- Limits are generous (400 edits, 600 dabs, brush up to 1.5 island radii, dabs up to 2 radii out); raise them in the tuning file if an island needs more.
