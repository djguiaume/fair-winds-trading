# 0214. Standing orders: people ask again

**Status:** Accepted (2026-10-25). Part 8 of the Phase 5 brief ([0207](0207-the-roadmap-after-phase-4.md), `docs/phase-5/brief.md`); words by the head storyteller (`docs/phase-5/story.md` › 2).

## Context

Once a person's arc was done they never spoke again. The brief asks for standing orders: anyone whose arc is done sometimes asks, on the Quay tab, for a good their port wants, in their own voice; one ask at a time per port, ignorable, no deadline; paid through the help orders' `helpReward`; frequency in a data file. Quests must run on the quest engine and be editable in the quest builder and `npm run quest`.

## Decision

- **A standing order is a quest with `"repeat": true`** (`src/data/quests/standing-<person>.json`, one per person, 14 people; Wren comes with the regattas). It is always `offer`ed at its `port`. Each step is one ask; the rounds take the steps in turn (round 1 the first step, round 2 the second, then round again), and a round ends with its step. Its progress keeps `rounds` (asks delivered) and, between rounds, `wait`.
- **The next ask** comes once the captain has docked `economy.orders.standingDockings` times (3) at other ports, in the tuning panel. **One ask at a time per port**: none while one runs there; of the people ready, the one asked fewest times, then file order (Rook and Kit take turns at Saltmere). "Not now" costs nothing; "Don't offer again" leaves the port to the next person.
- **Each ask lands a good at the port** (`landed`, goods handed over on docking, several trips allowed) and is **paid like a help order**: the new reward `"order": true` pays what a help order for those goods would pay at that port on the voyage's level, the bakehouse's share included, and grows the town like a help order (standing, growth × `helpGrowthFactor`, rare goods, the workshop). It is no port order: `contracts.completed` does not count it (that count seeds the next port orders).
- **Words** (storyteller, 43 asks, EN + FR): `<text>.<step>.title` "Bring timber to Saltmere", `.copy` the ask (mood neutral, never a number: the card shows "0 / 6"), `.thanks` the done line (pleased), `<text>.name` "Kit's standing order". The card reads "Kit's standing order · ask 2" instead of the step count. Settlers ask at their own outpost (timber); the keepers' asks pull the far goods to the main ports. Rook asks after `four-winds`, Kit after `saltmere-letter`, the others after their arc.
- **Checks:** a standing order is offered, has its port, pays on its steps, its steps have no `next`, `choose` or `unless`; a step paid `order` lands a good its port wants at some level.
- **Quest builder:** a "Standing order" switch, "Paid like an order" in the reward, each ask's card with its thanks card under it, "3 asks" in the list, standing orders listed under the story view (not in its columns); "Play from step" on an ask offers that ask with the ones before it done. `npm run quest list` marks them; `quest check` runs the same checks.
- **Saves:** `rounds` and `wait` in the JSON save and the FW2 code (its quest fingerprint changes, as with any new quest).
- **Balance:** the bots take an ask when they dock with its goods aboard (never buying for one): 4 to 7 % of the relaxed captain's income on the grown sea on all three levels. The far seas' late game rises to 5.4× the ring on Fair winds (target was ≤ 5×; 3.4× and 2.8× on Captain and Old salt), mostly because goods handed over don't flood the markets. With the storyteller: Fair winds may reach 6× (`lateVsRingTopByLevel`), the other levels keep 5×. Paying a plain order instead gave 5.3×, and 5 or 8 dockings changed nothing.

## Consequences

- Every arc person speaks again, at their port, with something small to do; the outposts get a reason to call.
- Fair winds' late game pays a little more; Guillaume set the 5× target, so the change is named in the PR.
- The regattas thread adds Wren's standing order the same way.
