# Community arcs: the people, their steps and the buildings they give you

**Status:** proposal, 2026-10-23, **waiting for Guillaume's approval before any content is built from it**. Names are placeholders. Numbers are examples to tune, not tuning.
**Follows:** [0120](../decisions/0120-communities-and-home-island.md) (arcs build your home island). **Recorded in:** [0122](../decisions/0122-community-arcs-story.md).
**Feeds:** the quest engine (step kinds it must support, [below](#what-the-quest-engine-needs)), the home island (build spots and buildings, [below](#what-the-home-island-needs)) and the characters' look (who to draw, [below](#the-people-at-a-glance)).

## The idea in one line

*The islands were thriving once; a hard winter left each port with one thing broken. You help one person per port mend it, and each one, grateful, helps you build up the little rock the harbourmaster gave you.*

No villains, no sad ending, kid-friendly. The story is told in short cards (two to four lines each), never long dialogue, so most of the time is still sailing.

## How it plays

- **Prologue, then four arcs.** The Saltmere harbourmaster gives you your home island right after the tutorial. Three arcs (Port Calda, Westholm, Stonehaven) then open together, in any order. The fourth (Watchman Key) opens when you discover Watchman Key, which the Stonehaven arc points you to (exploring finds it too).
- **Three steps per arc**, mixed on purpose so they are not "delivery orders with dialogue" (the main risk named in the [mockups](../reviews/progression/directions/README.md)): at most one plain delivery per arc, and at least one step that is about **sailing well** (precision near a reef, a passage through gates, a timed run), since the audience likes sailing first.
- **Every step can be done in the starter sloop or cutter.** Some steps suit a ship line better (haulers for heavy cargo, swift ships for timed runs), and the card says so, but nothing requires a particular ship.
- **No failure that costs anything.** A timed run can be retried as often as you like, from the dock where it starts. Par times come from the difficulty level.
- **Hazards stay optional** (Guillaume's rule): a step that mentions night or storms always works with them switched off. A "see it at night" step becomes "sail past it"; nothing waits for a storm.
- **Active play only** ([0097](../decisions/0097-progression-candidates-and-later-extensions.md)): no building produces anything over time, and nothing moves while the game is closed or paused.
- **The reward of an arc** is (1) a visible change in that port, which is never just extra growth, (2) a choice between two buildings for your home island, and (3) a little gold at each step (`src/data/tuning/quests.json`, scaled by difficulty).

## How long it lasts

Guillaume asked (2026-10-23) how long this should be and what similar games do. HowLongToBeat, main story / everything, as shown on Deku Deals:

| Game | Kind | Main story | Everything |
|---|---|---|---|
| [A Short Hike](https://dekudeals.com/items/a-short-hike) | small cozy exploration | 1.5 h | 4.5 h |
| [Alba: A Wildlife Adventure](https://www.dekudeals.com/items/alba-a-wildlife-adventure) | small cozy island | 2.5 h | 4 h |
| [Lil Gator Game](https://dekudeals.com/app/1586800) | small cozy exploration | 3 h | 5 h |
| [Dredge](https://www.dekudeals.com/items/dredge) | boat, fishing, upgrades | 9.5 h | 21 h |
| [Sail Forth](https://www.dekudeals.com/items/sail-forth) | sailing adventure | 16 h | 37.5 h |
| [Moonglow Bay](https://www.dekudeals.com/items/moonglow-bay) | cozy fishing town | 19 h | 29.5 h |
| [Summer in Mara](https://dekudeals.com/items/summer-in-mara) | island life, sailing, quests | 20.5 h | 28.5 h |

**Our estimate.** The balance test's legs take 30 to 130 s ([balance-targets.json](../../src/data/balance-targets.json), [0046](../decisions/0046-phase-1-economy-tuning.md)), so one voyage with docking and trading is about 2 to 3 minutes. One step is 2 to 4 voyages, so an arc is about 15 to 30 minutes of quest sailing. With the normal trading in between (money, town levels, a better ship) an arc takes 45 to 75 minutes, close to the 45 to 90 minutes guessed in the mockups. That's a guess from leg times. The balance test only simulates the first 40 to 120 minutes and does not measure a whole playthrough.

| | Time |
|---|---|
| Prologue | 10 to 15 min |
| One arc | 45 to 75 min |
| **Story (prologue + 4 arcs)** | **about 3 to 5 h** |
| Everything (both buildings of each pair, every town at Port town, every ship) | about 6 to 8 h |

**Recommended target for the first version: 3 to 5 hours of story**, about 10 to 15 sessions of 15 to 30 minutes, with the sandbox open afterwards. It sits with the small cozy games, which is our scale. The 10 to 20 hour games are full commercial releases with much larger worlds. Later, the 5x map makes legs about twice as long, and two more arcs (Abbey Head, Saltmere) bring the story to about 8 to 10 hours without new systems.

## The people at a glance

For the characters' look work. One portrait each, plus a simple mood change (pleased) for the end of the arc. All placeholder names.

| Person (placeholder) | Port | Role | Look notes for the art |
|---|---|---|---|
| **Harbourmaster Rook** | Saltmere (start) | runs the harbour, gives you the island | grey beard, navy coat with brass buttons, ledger under the arm; friendly, brisk |
| **Ines Calder** | Port Calda (timber) | old shipwright, yard closed since the winter | sixties, sleeves rolled, leather apron, pencil behind the ear, wood shavings; warm brown and rust |
| **Maren Holt** | Westholm (grain) | miller and baker, the mill lost its sails in a gale | thirties, flour on the hands, headscarf, wheat-gold and cream; the baker from mockup B1 |
| **Ada Flint** | Stonehaven (stone) | master mason, wants a light on the reef | forties, stone-grey smock, chisel and mallet, dust on the cheeks; slate and blue |
| **Old Ness** | Watchman Key (hidden, lamp oil) | retired pilot and lamp keeper | seventies, yellow oilskins, spyglass, weathered smile; lighthouse red and white |

A mix of ages and genders on purpose; the look work is free to change any of it.

## Prologue: "A rock of your own" (Saltmere)

**Hook.** *"You've a feel for the wind, captain. There's a rock east of here nobody uses. Make something of it."*

1. **Sail to your island** and tie up at the old pier (dock there). The first card shows the empty build spots.

**Change:** your home island appears on the chart under your name; its first spot (the pier) is already there. Which island is home is open in the Home island work; the mockups used Lantern Rock, just east of Saltmere, and nothing below depends on it.

## Arc 1: "The old slipway" (Port Calda, Ines Calder)

**Hook.** *"Forty years I built boats on that slipway. The winter cracked it and took my patterns with the old Gull. Help me lay one more keel."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. Stone for the ramp | Bring 8 stone from Stonehaven to Calda. | The arc's one plain delivery: a long leg across the map. | haulers |
| 2. The Gull's patterns | Sail to the wreck on East Reef and come alongside slowly (under ~2 kn within ~12 units of it) for 5 seconds to recover the shipwright's half-models. | Precision near a reef: come in slowly, mind the hull. | any |
| 3. Sea trial | Ines launches a little pilot cutter. Take its crew on a trial: from Calda, round Bell Rock and back within the par time. | A timed run with a turn to windward. Retry freely. | swift |

**Port Calda changes:** the slipway reopens with a hull on it at every level, and the pilot cutter is moored at the pier. **Planks are made from level 2** instead of level 3 (a data change in the port's `levelProduces`).

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Workshop** | Hull repairs at your home island, 25 % cheaper than in a port | exists: repairs and `repairCost` |
| **Rigging loft** | Sail upgrades 10 % cheaper anywhere | exists: upgrade prices |

These are the two examples from 0120.

## Arc 2: "The mill on the hill" (Westholm, Maren Holt)

**Hook.** *"The gale took the mill's sails clean off. No flour, no bread, and the harvest fair is in a week."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. New sails for the mill | Bring 8 timber from Port Calda to Westholm. | The arc's plain delivery. | any |
| 2. The millstones | Stonehaven's mason hands you two millstones (quest cargo: 4 hold spaces each, cannot be sold). Bring them to Westholm. | Hold size matters: a sloop makes two trips, a hauler one. | haulers |
| 3. Bread for the fair | Carry the first batch of bread to Saltmere within the par time, before it goes stale. | A timed run right across the map. Retry freely. | swift |

**Westholm changes:** the windmill on the hill turns again (a landmark at every level), and the **harvest fair puts Westholm up one level at once**. This is the "step up" kind of change from 0120: given once, as the reward, not as extra growth on deliveries.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Warehouse** | Keep up to 10 crates at home between voyages | new: home storage (was in direction A) |
| **Bakehouse** | Help orders pay 10 % more | exists: `helpRewardFactor` |

## Arc 3: "A light on the Teeth" (Stonehaven, Ada Flint)

The Teeth is a placeholder name for the reef between Skerry and Stonehaven's route (`sw-reef` in the map file).

**Hook.** *"Three boats on the Teeth since the winter. I can build a tower, but someone has to show me where the reef ends, and I need a lens."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. Sound the Teeth | Pass close to three markers along the reef's edge (inside ~15 units of each), in any order, without touching the reef. | Precision near danger: the arc's main sailing test. | any (nimble ships easier) |
| 2. The old lens | Ada's card points to "an old keeper out on Watchman Key". Find Watchman Key (shown as a rough circle on the chart) and bring back the lens Old Ness gives you (quest cargo). | Exploring: it discovers Watchman Key and opens arc 4. | any |
| 3. See it lit | Sail past the new light at night and look at the beam from the sea. **With night off, sailing past it at any time completes the step.** | A night approach (optional). | any |

**Stonehaven changes:** a lighthouse stands at the end of the Teeth with the Saltmere sweep ([0121](../decisions/0121-lighthouse-and-beacon-night-lights.md) rule), and the reef is drawn with a light on the chart. Stonehaven's quay gets the mason's crane.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Weather glass** | Shows the next wind change about 60 s before it comes | new: a forecast from the weather that already changes every few minutes |
| **Pilot house** | Hitting a reef or rock does 20 % less hull damage | exists: hull damage from crashes |

Both are about sailing and neither depends on night or storms being switched on.

## Arc 4: "The keeper's passage" (Watchman Key, Old Ness)

Opens when Watchman Key is discovered.

**Hook.** *"Before the winter I piloted boats through the Narrows. Saves half a day. My knees won't do it now, but my notes will, if you're any good."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. A roof again | Bring 6 timber and 6 grain to Watchman Key to mend Ness's cottage. | The arc's plain delivery. | any |
| 2. Ness's passage | Sail through the Narrows Reef passage by Ness's notes: three gates in order, without touching the reef. | Threading a channel, probably with a tack or two. | swift |
| 3. A letter for the abbey | Carry Ness's letter to Abbey Head, found from his bearings (rough circle on the chart). | Exploring: it discovers Abbey Head and its hauler yard. | any |

**Watchman Key changes:** the passage through the Narrows gets red and green beacons ([0121](../decisions/0121-lighthouse-and-beacon-night-lights.md)) and is drawn on the chart, a real shortcut from then on. Ness's pilot station flies a flag on the key.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Lookout** | Islands are discovered from 30 % farther | exists: `discoverRange` |
| **Boathouse** | New ships 10 % cheaper | exists: ship prices |

## The building choice

- **Eight buildings in four pairs**, one pair per arc; you build one of each pair, so four on your island at the end of the story.
- **The pairs are sidegrades:** each building helps a different way of playing (repairs or upgrades, storage or orders, reading the wind or forgiving mistakes, exploring or buying ships). Modifiers stay at 10 to 25 % so seamanship matters more.
- **The chosen building is the arc's reward**, no cost.
- **"Comes back later at a higher price" stays provisional** (0120). This doc's suggestion, to try with the prototype: the home island has **4 arc spots and 2 spare spots**. After the story, any building you passed over can be built on a spare spot for gold (about 3× an arc's gold). That gives the "about 6 buildings" of 0120 and keeps the choice meaningful, since you can't have everything. If Guillaume drops the rule, the spare spots simply go.

## What the quest engine needs

The step kinds above, as a list for the quest engine work (built from [first-voyage.json](../../src/data/quests/first-voyage.json)'s format):

| Need | Used by |
|---|---|
| Many quests active at once, one tracked in the journal | all |
| Start conditions: quest finished, port discovered | arcs 1 to 4 |
| Deliver *qty* of a good to a port | 1.1, 2.1, 4.1 |
| Quest cargo: given at a port, takes hold spaces, cannot be sold or dumped | 2.2, 3.2 |
| Reach markers: one point slowly (speed under *x* within *r* for *t* s), several points in any order, or gates in order | 1.2, 3.1, 4.2 |
| "Without touching the reef" (a hit resets the step to its start, no other cost) | 3.1, 4.2 |
| Timed run from a dock with a par per difficulty, free retries | 1.3, 2.3 |
| Pass a point, at night when night is on, at any time when it is off | 3.3 |
| Find a port from a rough circle on the chart (discovery event) | 3.2, 4.3 |
| Dock at a port | prologue |
| Rewards: gold, a port change (props per level, `levelProduces` override, one level up, chart marks), a two-building choice | all |

## What the home island needs

- **6 build spots** (4 arc spots, 2 spare), plus the pier from the prologue.
- **8 buildings** in `src/data/buildings.json`, each with a prop, a pair id and a modifier. Props that exist already and could stand in: warehouse, granary, sawmill, slipway, lighthouse, beacon, barn, cabin.
- New modifier hooks: home storage (Warehouse) and the wind forecast (Weather glass). The other six change numbers that already exist.

## Open questions for Guillaume

1. Are these four people and ports the right ones? Saltmere only has the prologue because it's the start port; it could get its own arc later, with Abbey Head.
2. Is "at most one plain delivery per arc" the right balance, or should there be more sailing steps or more trading?
3. Do the eight buildings and their modifiers feel like real sidegrades?
4. The spare-spot version of "comes back later": try it in the prototype, or leave it out?
