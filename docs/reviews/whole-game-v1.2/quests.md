# Every quest and how they tie together (2026-10-29)

Part of the [whole-game review](README.md). Read from `src/data/quests/` (53 files, 127 steps) and
the English text in `src/i18n/en.json` on `main` at `56a9f49`. Rules: the
[storyteller brief](../../story/storyteller-brief.md). The 15 people are in `characters.json`.

## The chain in one picture

```
first-voyage (tutorial, 16 steps) ──┐        sailing-lessons (on request, 5 steps)
   or "Free sailing" (skipped)      ▼
                              rooks-thanks  (Saltmere → Skerry → the four plots)
                 ┌──────────────┬─────┴────────┬──────────────┬────────────┐
                 ▼              ▼              ▼              ▼            ▼
         saltmere-shoals  calda-slipway  westholm-mill  stonehaven-light  club-hint, 6 ring races
            (Kit, spot 3) (Ines, spot 1) (Maren, spot 2) (Ada, spot 4)     (Wren at Abbey Head)
                 └──────────────┴──────┬───────┴──────────────┘
                                       ▼ all four
                                  fair-winds (epilogue: the company is named)

 stonehaven-light + a call at Watchman Key ──► watchman-passage (Ness's chart south)
                                                     │
      ┌──────────────────────┬───────────────────────┼───────────────────────┐
      ▼                      ▼                       ▼                       ▼
 (no letter)           saltmere-letter          calda-letter           westholm-letter
 sunreach-tea (Juno)   + saltmere-shoals        + calda-slipway        + westholm-mill
      │                rimewick-jam (Sigrun)    emberhold-glass (Bram) fogwatch-amber (Elias)
      ▼                      ▼                       ▼                       ▼
 outpost-south (Tam)   outpost-north (Nell)     outpost-west (Oskar)   outpost-east (Pip)
      └──────────────────────┴───────────┬───────────┴───────────────────────┘
                                         ▼ all four
                                    four-winds (the signpost on Skerry's pier)
                                         ▼
                              race-four-winds (the Cup), standing-rook
```

Each sea also opens its races once its outpost stands, and each person's standing order once their
arc is done.

## The 53 quests by kind

| Kind | Count | Quests |
|---|---|---|
| Tutorial | 2 | `first-voyage` (the rescue prologue, 16 steps, [0127](../../decisions/0127-prologue-rescue-tutorial.md)), `sailing-lessons` (5 steps, on request) |
| Hub | 2 | `rooks-thanks` (4 steps, with a `skerry-stranger` variant for players who skipped the tutorial, [0160](../../decisions/0160-skipping-the-tutorial-keeps-its-story.md)), `club-hint` (Rook points to Abbey Head) |
| Ring arcs | 4 | `saltmere-shoals`, `calda-slipway`, `westholm-mill`, `stonehaven-light`: 3 steps each, each pays a Skerry plot |
| Epilogue | 1 | `fair-winds` (200 gold, the company named) |
| Gateways | 4 | `watchman-passage` (Ness's chart), `saltmere-letter`, `calda-letter`, `westholm-letter`: one "sail there" step each |
| Sea arcs | 4 | `sunreach-tea`, `emberhold-glass` (reward: the Smoulder erupts), `rimewick-jam`, `fogwatch-amber`: 3 to 4 steps each |
| Outposts | 4 | `outpost-south` Palm Key (Tam), `outpost-west` Cinder Isle (Oskar), `outpost-north` Snowberry Isle (Nell), `outpost-east` Amber Strand (Pip): supplies, then the settler |
| Closing beat | 1 | `four-winds` (300 gold, the signpost) |
| Races | 16 | 8 regatta races ([0217](../../decisions/0217-the-saltmere-regatta.md)) and 8 club races ([v1.1](../../releases/v1.1.282.md)), one `raced` step each |
| Standing orders | 15 | one per person, 3 asks (Ness 4), repeatable ([0214](../../decisions/0214-standing-orders-people-ask-again.md)) |

Gold written into the quests: 12,500 over the 127 steps (about 500 per arc, as the brief says).

## How they gate each other

- **Start.** Rook's thanks opens as soon as the tutorial reaches the island step or was skipped. It
  sends the player to Saltmere, then to Skerry, then names Kit, Ines, Maren and Ada. All four ring
  arcs open at the `skerry` step, in any order, and so do Rook's club hint and six club races.
- **The ring.** Each arc is hook, middle, done: a delivery, a sail somewhere (the reef gap, the
  Greyback mast, the millstones, the Teeth), and a timed or carried finish. Every done card names
  the plot and its two buildings (rule 12). Westholm's arc also raises Westholm a level. The
  epilogue needs all four and ends with the company's name.
- **The seas open from Stonehaven.** Ness's chart (`watchman-passage`) needs Ada's arc done and a
  call at Watchman Key; it is the single key to the south. The three letters each need their own
  ring arc **and** Ness's chart ([0194](../../decisions/0194-open-the-edge-seas-after-each-ring-arc.md)).
  So Stonehaven is the one compulsory arc; the other three can wait, but their seas wait with them.
- **Each sea is the same shape:** gateway (one sail), craft arc (bring a ring good, look at a place,
  bring a ring good), outpost (supplies, then carry the settler). The four seas run side by side.
- **Four winds** needs the four outposts and gives the signpost and Rook's own standing order.
- **Races.** Six ring races open at Rook's thanks. The two long ones (`race-abbey`, `race-mill`)
  and the three squall races hang off `race-greyback` plus the sea's outpost; the four sea races
  and the Cup hang off `race-gap` plus the outpost (the Cup needs `four-winds`). Wren's standing
  order opens after the three regatta ring races.
- **Standing orders** open on the giver's arc (ring people on their letter, so after their arc and
  the chart; settlers and sea people on the outpost; Rook on four-winds).

## What the reading shows

**Good.**

- The chain has one clear spine and never dead-ends: every quest has a start condition that a
  player who follows the cards will meet, and nothing can fail. The skipped-tutorial variant keeps
  the story whole.
- The ring arcs are the best written: three different kinds of sailing each (a buoyed gap, a
  carried mast, a timed rush, carrying Rook himself), and each pays something visible (a plot, the
  lit Teeth, the mill, buoys on the gap).
- The gateways are good storytelling for free: a letter from a brother (Ines and Oskar), a
  keeper's old chart, each with the sea's hazard named in one line ("through the Forge Gap in the
  black reef", "wait for the quiet breath").
- The voices hold across 53 files: Rook's ledger, Ness's wandering, Maren's "and", Wren's needling.
  Each race card names a person of the sea it runs in, so the regatta sews the cast together.
- Everything is data: no quest is named in code, and `npm run check` and the balance bots play all
  of it on three levels.

**Weak.**

1. **Four seas, one template, still.** The 2026-10-25 review said it and v1.0 added life around the
   arcs (races, standing orders, news lines) but not inside them: every sea is letter, bring a ring
   good, look, bring a ring good, supplies, settler. The sea's own hazard is never a step (nobody
   asks you to cross the Stormbreak in a lull, wait out a doldrum, or thread the pack ice; Sigrun
   says "keep off the ice" and that is all).
2. **The far goods play no part in the story.** Tea, mirrors, jam and amber exist only after the
   outposts, and no quest ever asks for one. Every delivery in all 53 quests is a ring good (timber,
   planks, stone, fish, grain, bread, lamp oil). Standing orders repeat this: Nell asks for timber
   three times.
3. **Nothing happens after four-winds.** The company has a name and a signpost, then the Cup, then
   standing orders. The "company" does nothing a company would do: no order book of its own, no
   second captain, no growth to see. Skerry stops at four buildings.
4. **The outposts are founded and forgotten.** Each is two steps, then a standing order. Nothing
   grows them past the player's own deliveries, and the settlers never write home.
5. **Stonehaven is the only door.** A player who dislikes Ada's arc cannot reach any sea; a player
   who finishes Saltmere first gets a letter that does nothing until Ness's chart. That is fine for
   a first play, but the game never tells the player which arc opens the seas.
6. **Small things to tidy:** `standing-wren` is offered at Saltmere while Wren lives at Abbey Head
   (her club house is there since v1.1); the brief's Status line is stale (handover note); the
   regatta's "Saltmere Regatta" and the club at Abbey Head should read as one thing on the Quay.

**What a next story release should do** (the storyteller's call, in this order):

1. One step per sea that uses the sea's hazard as the task, inside the existing arcs or as a
   fourth card: the Stormbreak lull, the doldrums, the ice lead, the ash wind.
2. Asks that use the far goods across the seas (Sigrun wants Juno's tea; Bram's mirrors for the
   Teeth light), as standing orders first, since they are cheap.
3. A chapter after four-winds that makes the company a company: a second boat or a rival bid, or
   the expedition past the Stormbreak as the extension the roadmap keeps.
