# Community arcs: the people, their steps and the buildings they give you

**Status:** approved by Guillaume, 2026-10-23 (after one round of feedback). Content can now be built from it. Names are final ([storyteller brief](storyteller-brief.md), [0129](../decisions/0129-storyteller-brief.md)). The open questions at the end stay open for the prototype. Numbers are examples to tune, not tuning.
**Follows:** [0120](../decisions/0120-communities-and-home-island.md) (arcs build your home island). **Recorded in:** [0122](../decisions/0122-community-arcs-story.md).
**Feeds:** the quest engine (step kinds it must support, [below](#what-the-quest-engine-needs)), the home island (build spots and buildings, [below](#what-the-home-island-needs)) and the characters' look (who to draw, [below](#the-people-at-a-glance)).

## The idea in one line

*The islands were thriving once; a hard winter left each port with one thing broken. You fish the harbourmaster out of a wreck, he gives you a run-down island, and you help one person in each port mend what the winter broke. Each one, grateful, helps you build up your island.*

No villains, no sad ending, kid-friendly. The story is told in short cards (two to four lines each), never long dialogue, so most of the time is still sailing.

## Guillaume's feedback (2026-10-23) and what changed

- **The tutorial becomes the prologue:** you start at sea, learn the controls, hear a foghorn, rescue the Saltmere harbourmaster from a wreck and take him home; he gives you the dilapidated island. See [the tutorial and prologue](#the-tutorial-and-prologue-the-foghorn).
- **Each arc follows its town's trade:** Saltmere is about fish and the reef (it now has its own arc), Port Calda about timber and boatbuilding, Westholm about grain, Stonehaven about stone.
- **Port Calda is explained more clearly**, and its middle step is now about timber (fetching a mast tree) instead of a wreck, so the rescue's wreck stays the only one.
- **Watchman Key and Abbey Head move to later arcs.** Old Ness still appears in the Stonehaven arc, which still leads you to discover Watchman Key.

## How it plays

- **The tutorial and prologue, then four arcs.** The tutorial ends with the harbourmaster giving you your island. Then the four arcs (Saltmere, Port Calda, Westholm, Stonehaven) open together, in any order. Each arc is about what its town makes.
- **Three steps per arc**, mixed on purpose so they are not "delivery orders with dialogue" (the main risk named in the [mockups](../reviews/progression/directions/README.md)): at most one plain delivery per arc, and at least one step that is about **sailing well** (precision near a reef or a shore, a passage through gates, a timed run), since the audience likes sailing first.
- **Every step can be done in the starter sloop or cutter.** Some steps suit a ship line better (haulers for heavy cargo, swift ships for timed runs), and the card says so, but nothing requires a particular ship.
- **No failure that costs anything.** A timed run can be retried as often as you like, from the dock where it starts. Par times come from the difficulty level.
- **Hazards stay optional** (Guillaume's rule): a step that mentions night or storms always works with them switched off. A "see it at night" moment happens at any time when night is off; nothing waits for a storm.
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
| Tutorial and prologue (rescue, island, first trade) | 15 to 20 min |
| One arc | 45 to 75 min |
| **Story (prologue + 4 arcs)** | **about 3 to 5 h** |
| Everything (both buildings of each pair, every town at Port town, every ship) | about 6 to 8 h |

**Recommended target for the first version: 3 to 5 hours of story**, about 10 to 15 sessions of 15 to 30 minutes, with the sandbox open afterwards. It sits with the small cozy games, which is our scale. The 10 to 20 hour games are full commercial releases with much larger worlds. Later, the 5x map makes legs about twice as long, and the Watchman Key and Abbey Head arcs bring the story to about 8 to 10 hours without new systems.

## The people at a glance

For the characters' look work. One portrait each, plus a simple mood change (pleased) for the end of the arc. All placeholder names.

| Person (placeholder) | Port and trade | Role | Look notes for the art |
|---|---|---|---|
| **Harbourmaster Rook** | Saltmere | runs the harbour; you rescue him, he gives you the island | grey beard, navy coat with brass buttons (soaked and missing his cap when rescued), ledger under the arm; friendly, brisk |
| **Kit Marlow** | Saltmere, fish | fisher, leads the fishing boats | thirties, knitted jumper, sou'wester hat, net over the shoulder; sea green and white |
| **Ines Calder** | Port Calda, timber | old shipwright, yard idle since the winter | sixties, sleeves rolled, leather apron, pencil behind the ear, wood shavings; warm brown and rust |
| **Maren Holt** | Westholm, grain | miller and baker, the mill lost its sails in a gale | thirties, flour on the hands, headscarf; wheat-gold and cream; the baker from mockup B1 |
| **Ada Flint** | Stonehaven, stone | master mason, wants a light on the reef | forties, stone-grey smock, chisel and mallet, dust on the cheeks; slate and blue |
| **Old Ness** | Watchman Key, lamp oil | retired lamp keeper; small part now, his own arc later | seventies, keeper's coat and cap, spyglass, weathered smile; lighthouse red and white |

A mix of ages and genders on purpose; the look work is free to change any of it.

## The tutorial and prologue: "The foghorn"

Guillaume's idea. It replaces today's tutorial start (you begin docked at Saltmere) and keeps its lessons; the steps of [first-voyage.json](../../src/data/quests/first-voyage.json) are reused, only their order and setting change.

| Step | What happens | Lesson (today's tutorial step) |
|---|---|---|
| 1. Alone at sea | You start on an open stretch of sea with no port in sight, in your sloop. | sails, steering (`sails`) |
| 2. Reading the wind | Short tips on the wind compass and points of sail. | wind (`wind`) |
| 3. A foghorn | A foghorn sounds from one direction, and the compass shows a mark towards it. Sail towards the sound. | sailing to a bearing (new) |
| 4. The wreck | A small boat is stuck on a reef with someone waving from it. Come alongside **slowly** (under ~2 kn close to it) without hitting the reef. Harbourmaster Rook climbs aboard. | slowing down, reefing the sails (new) |
| 5. Home to Saltmere | Rook asks to go home. Pick Saltmere on the chart and dock. | chart, docking (`chart`, `dock`) |
| 6. The island | Rook thanks you: *"There's an old island west of here, nobody's lived there since the winter. It's yours if you can make something of it."* Your island appears on the chart, run-down: a broken pier, a roofless cabin, the empty build spots. | new |
| 7. First trade | Rook suggests a first cargo: buy, deliver, sell, as today. | `buy`, `deliver`, `sell` |

- **Skipping the tutorial** still gives you the island: Rook's thank-you card shows when you first dock at Saltmere.
- **Old voyages** that already finished the tutorial get the same card from Rook at their next Saltmere visit, so nobody misses the island.
- **Where you start** is for the map: an empty stretch near Saltmere, far enough from the hidden ports that they stay hidden. The wreck sits on the nearest reef. **Home is Skerry** (Guillaume's pick in the Home island work, 2026-10-23): central, a reach both ways from Saltmere, right by the Teeth.
- **New things it needs:** a foghorn sound (one line in `audio.json`), a direction mark on the compass, the wreck with a figure on it (the `wreck` prop exists), the passenger (quest cargo that takes no hold space) and a "run-down" level for the home island.

## Arc 1: "Where the shoals went" (Saltmere, fish, Kit Marlow)

**The situation.** Saltmere lives on fish. Since the winter storms the shoals have left the bay, and the boats come home empty. Kit thinks they moved out past the reef.

**Hook.** *"My boats come home empty every day. The fish are out there somewhere, past the reef. You've got sharp eyes and a quick boat."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. Find the shoal | Sail along the reef's outer edge. At three spots, gulls are diving: pass close to each one, in any order. At one of them, fish are jumping. | Reading the sea, sailing close to a reef without touching it. | any (nimble ships easier) |
| 2. A safe way through | The shoal lies beyond the reef. Sail through the gap in the reef by three gates, in order, so Kit can mark the way with buoys. | Threading a channel, probably with a tack or two. | swift |
| 3. The first catch | Rush Kit's first big catch (quest cargo) to Port Calda within the par time, before it spoils. | A timed run. Retry freely. | swift |

**Saltmere changes:** fishing boats work the new ground by the reef at every level, the gap in the reef gets buoys and is drawn on the chart (a real shortcut from then on), and **smoked fish is made from level 2** instead of level 3.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Lookout** | Islands are discovered from 30 % farther | exists: `discoverRange` |
| **Pilot house** | Hitting a reef or rock does 20 % less hull damage | exists: hull damage from crashes |

## Arc 2: "The last keel" (Port Calda, timber, Ines Calder)

**The situation, explained.** Port Calda is the timber town. Its yard used to turn Calda's own wood into the islands' boats. The boats are built on a **slipway**, a stone ramp that slopes into the water so a finished hull can slide into the sea. The winter storm cracked the slipway, and the yard has stood idle since. Ines, the old shipwright, wants to build one more boat: a **pilot cutter**, a small fast boat that guides ships into Calda's harbour. Building it needs three things: a new stone ramp, a mast, and a launch day.

**Hook.** *"Forty years I built boats on that slipway. One more, a pilot cutter for the harbour, and I'll hang up my adze. But the ramp's cracked and there's no mast tree left on Calda."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. Stone for the ramp | Bring 8 stone from Stonehaven to Calda to rebuild the slipway. | The arc's one plain delivery: a long leg across the map. | haulers |
| 2. The mast tree | The only pine tall enough grows on Greyback Ridge, which has no harbour. Come in slowly to the landing spot (under ~2 kn close to the shore) and load the trunk (quest cargo, takes most of the hold). | A slow, careful approach to a shore. | haulers |
| 3. Launch day | The cutter is ready. Fetch Harbourmaster Rook from Saltmere for the launch and get him to Calda within the par time. | A timed run. Retry freely. | swift |

**Port Calda changes:** the slipway is rebuilt with a hull on it at every level, the new pilot cutter is moored at the pier, and **planks are made from level 2** instead of level 3.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Workshop** | Hull repairs at your home island, 25 % cheaper than in a port | exists: repairs and `repairCost` |
| **Rigging loft** | Sail upgrades 10 % cheaper anywhere | exists: upgrade prices |

These are the two examples from 0120, and both fit a shipwright.

## Arc 3: "The mill on the hill" (Westholm, grain, Maren Holt)

**The situation.** Westholm grows grain and bakes the islands' bread. A gale took the windmill's sails, so there's no flour, and the harvest fair is close.

**Hook.** *"The gale took the mill's sails clean off. No flour, no bread, and the harvest fair is in a week."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. New sails for the mill | Bring 8 timber from Port Calda to Westholm. | The arc's plain delivery. | any |
| 2. The millstones | Ada, Stonehaven's mason, hands you two millstones (quest cargo: 4 hold spaces each, cannot be sold). Bring them to Westholm. | Hold size matters: a sloop makes two trips, a hauler one. | haulers |
| 3. Bread for the fair | Carry the first batch of bread to Saltmere within the par time, before it goes stale. | A timed run right across the map. Retry freely. | swift |

**Westholm changes:** the windmill on the hill turns again (a landmark at every level), and the **harvest fair puts Westholm up one level at once**. This is the "step up" kind of change from 0120: given once, as the reward, not as extra growth on deliveries.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Warehouse** | Keep up to 10 crates at home between voyages | new: home storage (was in direction A) |
| **Bakehouse** | Help orders pay 10 % more | exists: `helpRewardFactor` |

## Arc 4: "A light on the Teeth" (Stonehaven, stone, Ada Flint)

The Teeth is a placeholder name for the reef that runs west from Skerry, your home island (`sw-reef` in the map file). The Teeth Rock is its far, western end: a new small rock to add in the map file.

**The situation.** Stonehaven quarries and cuts stone. Three boats have hit the Teeth since the winter. Ada wants to build a stone lighthouse on the Teeth Rock, at the reef's far end, within sight of your island.

**Hook.** *"Three boats on the Teeth since the winter. I'll build a tower on the Teeth Rock that'll stand a hundred years. I need a strong boat for the stone and a lens for the top."*

| Step | What you do | Sailing in it | Suits |
|---|---|---|---|
| 1. Timber for the scaffold | Bring 6 timber from Port Calda to Stonehaven. | The arc's plain delivery. | any |
| 2. Stone for the tower | Carry the cut-stone blocks (quest cargo, heavy) to the Teeth Rock, which has no harbour. Come in slowly to the landing spot, between the rocks. | A careful approach near the reef with a heavy, slow ship. | haulers |
| 3. The old lens | Ada's card points to "an old keeper out on Watchman Key". Find Watchman Key (shown as a rough circle on the chart), and bring the lens Old Ness gives you to the Teeth Rock. The light comes on as you leave, and you see the beam from the sea (at night if night is on). | Exploring: it discovers Watchman Key. | any |

**Stonehaven changes:** a stone lighthouse stands on the Teeth Rock with the Saltmere sweep ([0121](../decisions/0121-lighthouse-and-beacon-night-lights.md) rule), the reef is drawn with a light on the chart, and Stonehaven's quay gets the mason's crane.

**Choose one for your home island:**

| Building | Modifier (example) | Hook in the game |
|---|---|---|
| **Weather glass** | Shows the next wind change about 60 s before it comes | new: a forecast from the weather that already changes every few minutes |
| **Boathouse** | New ships 10 % cheaper | exists: ship prices |

Neither depends on night or storms being switched on.

## Later arcs (not in the first version)

- **Watchman Key, lamp oil, Old Ness:** "The keeper's passage", a beaconed channel through the Narrows reef ([0121](../decisions/0121-lighthouse-and-beacon-night-lights.md) beacons).
- **Abbey Head, honey:** an arc about the abbey's bees and the hauler yard.

Both fit the 5x map and bring the story to about 8 to 10 hours.

## The building choice

- **Eight buildings in four pairs**, one pair per arc; you build one of each pair, so four on your island at the end of the story.
- **The pairs are sidegrades:** each building helps a different way of playing (exploring or forgiving mistakes, repairs or upgrades, storage or orders, reading the wind or buying ships). Modifiers stay at 10 to 25 % so seamanship matters more.
- **The chosen building is the arc's reward**, no cost.
- **"Comes back later at a higher price" stays provisional** (0120). This doc's suggestion, to try with the prototype: the home island has **4 arc spots and 2 spare spots**. After the story, any building you passed over can be built on a spare spot for gold (about 3× an arc's gold). That gives the "about 6 buildings" of 0120 and keeps the choice meaningful, since you can't have everything. If Guillaume drops the rule, the spare spots simply go.

## What the quest engine needs

The step kinds above, as a list for the quest engine work (built from [first-voyage.json](../../src/data/quests/first-voyage.json)'s format):

| Need | Used by |
|---|---|
| Many quests active at once, one tracked in the journal | all |
| Start conditions: quest finished, port discovered | arcs |
| Start the voyage at a set spot at sea | prologue 1 |
| A sound with a direction mark on the compass | prologue 3 |
| Deliver *qty* of a good to a port | 2.1, 3.1, 4.1 |
| Quest cargo: given at a port or a spot, takes hold spaces (a passenger takes none), cannot be sold or dumped | prologue 4, 1.3, 2.2, 2.3, 3.2, 4.2, 4.3 |
| Reach markers: one point slowly (speed under *x* within *r* for *t* s), several points in any order, or gates in order | prologue 4, 1.1, 1.2, 2.2, 4.2 |
| "Without touching the reef" (a hit resets the step to its start, no other cost) | prologue 4, 1.1, 1.2 |
| Timed run from a dock with a par per difficulty, free retries | 1.3, 2.3, 3.3 |
| Find a port from a rough circle on the chart (discovery event) | 4.3 |
| Dock at a port | prologue 5 |
| Rewards: gold, the home island, a port change (props per level, `levelProduces` override, one level up, chart marks), a two-building choice | all |

## What the home island needs

- **A run-down first look** (broken pier, roofless cabin) for the prologue.
- **6 build spots** (4 arc spots, 2 spare), plus the pier.
- **8 buildings** in `src/data/buildings.json`, each with a prop, a pair id and a modifier. Props that exist already and could stand in: warehouse, granary, sawmill, slipway, lighthouse, beacon, barn, cabin.
- New modifier hooks: home storage (Warehouse) and the wind forecast (Weather glass). The other six change numbers that already exist.

## Open questions, to check with the prototype

1. Do the four arcs now match their towns well enough?
2. Is "at most one plain delivery per arc" the right balance, or should there be more sailing steps or more trading?
3. Do the eight buildings and their modifiers feel like real sidegrades?
4. The spare-spot version of "comes back later": try it in the prototype, or leave it out?
