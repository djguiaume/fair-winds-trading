# 0283. Each far sea's hazard is a turn in its keeper's arc

**Status:** Accepted (2026-11-04, v1.6 scope option 2 OK'd by Guillaume; issue #359).

## Context

The [whole-game story review](../reviews/whole-game-v1.2/quests.md) and the v1.6 storyteller
review found the four far seas on one template (letter, bring, look, bring, supplies, settler): the
sea's own hazard was never a task, the settlers' siblings only got letters, nothing pointed past
the Stormbreak, and Wren lived only at Abbey Head. The v1.6 brief asks for one hazard step per sea,
outposts in one card, reunions on screen, one oddity per sea and Wren once per sea, as data only.

## Decision

- **The sea's turn:** each keeper's arc gets one new step, spoken by Wren: carry one washed-up
  oddity (quest cargo, one hold space) from a spot inside the sea's hazard to the keeper. South
  `sunreach-tea.glass` (The Glass, the doldrums, a sealed bottle), east `fogwatch-amber.lull`
  (mid-Stormbreak, a carved plank), north `rimewick-jam.calving` (The Calving Grounds' bergs, a tin
  box), west `emberhold-glass.ash` (Ashfall Reach, a brass compass; Bram's bell rings as the step's
  sound). Each oddity bears the same unnamed mark, a star over a wave; #361 picks the thread up.
- **Nothing can fail and Settings still rule:** the spot is the same with the hazard switched off,
  only calm. No `clean` on these steps: a knock on a berg or a pier must not drop the oddity.
- **Outposts in one card:** each outpost's supplies and settler are one step (`settler`, the
  shipped id), and the settler's sibling from the ring comes too (Ness, Ines, Kit, Maren), so the
  done card is the reunion. Gold is the sum of the two old steps. Four different closers.
- **Balance bots:** an `all` goal made only of fetch-and-bring parts (`delivered`, `landed`,
  `carried`) is sailed as a captain would: every fetch first, then one call at each drop
  (`questVisits` in `src/sim/balanceStory.ts`).

## Consequences

- Story balance (`npm run balance -- --map phase4 --only story`) passes 9/9 on all three levels;
  the seas are founded a little sooner than before, as the bots no longer sail to the landing
  once per part.
- A save stopped at an outpost's old `supplies` step, or inside `settler`, is re-offered from the
  new one-card step (the engine drops a step it cannot read; nothing else is lost).
- The lines are the storyteller's, kept in `docs/story/v1.6/`.
