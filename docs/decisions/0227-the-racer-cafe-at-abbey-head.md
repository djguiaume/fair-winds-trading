# 0227. The racer café at Abbey Head

**Status:** Proposed (2026-10-28).

## Context

The storyteller moved the Sailing Club from the Saltmere quay to Abbey Head and opened the ring
races right after the prologue (`docs/story/club-words.md`, "Update 2026-10-28"; Guillaume agreed
to Abbey Head). Abbey Head is already a hidden shipyard with a dockable pier and a Quay tab, so
the club needs no new port, only a place on it, a way to find it and the races' offers.

## Decision

- **A shed and a café on the quay.** Wren's shed (`boathouse`) and the café (`beach-house`) stand
  at Abbey Head from level 1, in place of the two level-1 yard houses, so the island's mobile
  triangle budget (0073) does not grow. The yard keeps its pier, which still comes at level 4.
- **Rook's line and the chart flag.** `club-hint` starts when `rooks-thanks` is done: Rook says
  Wren has a shed on Abbey Head, and the step's goal (dock there) puts the flag on the chart.
  Wren speaks the arrival card when she first docks (`doneSpeaker`). No other quest step.
- **Races are offered at Abbey Head.** Every race quest has `port: abbey-head`, so the offers and
  the regatta book are on its Quay tab. The three ring races start when `rooks-thanks` is done
  (they no longer chain); the sea races and the Cup keep their gates. Wren's `character.port` is
  Abbey Head, and her first ring line says "visiting skipper".
- **Early gold.** The ring races pay 30 / 60 / 100 (was 60 / 120 / 200) because they open in the
  first minutes: racing gold per minute stays near what trading pays, so the cutter (1,500) does
  not arrive early. Pars are unchanged (stock ships, all three levels, `npm run race`).

## Consequences

- The balance bots do not race; the economy milestones are unchanged and pass on all three levels.
- A player can meet the club before the first town is built; the Tern prize (#311) and the club
  board move (#309) build on this.
