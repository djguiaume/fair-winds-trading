# 0184. Speech per way of playing

**Status:** Accepted (2026-10-25, Guillaume's ask).

## Context

Decision 0183 added a controller version of a text (`key@pad`), shown as an extra optional row
in the quest builder. Guillaume (2026-10-25): the speech should have a default and a version per
control scheme. A touch-only player should never read about keys, a keyboard and mouse player
reads the keys as now, and a controller player reads the buttons. It should not be "an
additional useless optional line".

## Decision

- **Four versions of a text**: `key` is the default every player reads; `key@touch`,
  `key@keys` and `key@pad` are optional versions for a touch screen, keyboard and mouse, and a
  game controller (`TEXT_VARIANTS` in `src/i18n`). `t()` reads the version for the current way
  of playing when it exists and is not empty, else the default. The default names no controls.
- **The way of playing** (`src/input/wayOfPlaying.ts`, `WayOfPlaying`) is the last input: a
  finger or pen → touch, a mouse click or a key → keys, the pad (from the poller) → pad. The
  pad's own keys and clicks on Edge for Xbox (0183) are ignored. Before any input, a touch screen
  with no fine pointer is touch, else keys. Changing way redraws the lesson bubble at once.
- **The quest builder**: each speech row (step speech and thanks) has tabs under its label:
  default, touch, keyboard & mouse, controller. A dot marks the versions that have text. The tab
  picks which version both languages edit, the empty box shows the default as a hint, and the
  card above shows that version. `lineKeys()` lists a line's keys, and the text checks cover
  every version (both languages, the same `{…}`).
- The first voyage's lessons that name controls (map, course, sails, Sell all) now have a neutral
  default and all three versions, in English and French.
- `npm run shots` runs `--script`, `--style` and `--focus` in the editors too, so a shot can open
  the quest builder on a step.

## Consequences

- Any quest's speech can name the right controls for each player, written and checked in the
  builder like any other text.
- Lines other than speech (asks, option titles) have no versions yet; add `variants: true` to
  their entry in `textKeys()` if one ever needs them.
- Tests: `tests/wayOfPlaying.test.ts` (versions, the way from events, the pad's clicks ignored,
  builder keys).
