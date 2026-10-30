# The whole game before v1.2 ships (review, 2026-10-29)

Guillaume asked for a fresh look at the game, its story, the v1 and v2 graphics, the UI, the v1.2
plan and the roadmap, with a clear view of what is good, what is missing, what must be addressed
and where the game should go. Earlier review, after Phase 4: [whole-game](../whole-game/README.md).
Read-only: nothing in code changed. Companions: [quests.md](quests.md), every quest and how they
chain; [consultant.md](consultant.md), an outside view of identity, length, engine, platform,
audience, extensions and money (added 2026-10-30).

Checked on `main` at `56a9f49` (v1.1.282 released, v1.2 half built): the roadmap, the v1.2 brief
and plan, decisions 0207 to 0238, the storyteller brief and handover, the art bible and handover,
the open issues, all 53 quest files with their English text, and real screenshots with
`npm run shots` in both looks.

## The concept, in one paragraph

Fair Winds Trading Co. is a browser game for people who like sailing: a low-poly storybook sea
where reading the wind is the game, deliveries grow the towns, and helping the islands' people
builds your own island. No villains, no danger, nothing fails. It runs on a phone, a tablet, a
desktop and the Xbox browser, in English and French, with a save you carry as a QR code. The base
game shipped as 1.0 (four seas, 15 people, regattas, a living sea) and 1.1 added Wren's sailing
club, a turnable camera, Ultra graphics and the style E skin. That concept is sound and it is
delivered: the question now is what the next releases should spend their effort on.

## The game today

| Part | State (change since the 2026-10-25 review in bold) |
|---|---|
| Sailing | Arcade sailing with a no-go zone, tacking, heel, gusts, shifts, lee, wind zones, currents, shallows, reefs, bergs, the storm belt, storms, day and night. **Turnable camera. Fixed squalls in races.** |
| Trade | 18 goods, moving markets, orders, help orders, credit. Unchanged since 1.0. |
| Ships | 7 ships in 3 lines, 3 upgrade tracks, **plus the Tern, the Pilot and the Yawl at Abbey Head. Visible hull damage.** |
| Towns and outposts | 4 levels, 2 outposts per sea. **Ring ports caught up; the harbour screen shows the town.** |
| Story | **53 quests**: tutorial, Rook's hub, 4 ring arcs, the epilogue, 4 gateways, 4 sea arcs, 4 outposts, four-winds, **16 races, 15 standing orders**. About 3 to 4 hours for the story, more for the Cup. |
| Sea | **Other boats sail by the same wind (21 fleets). Sounds per sea.** |
| Look | v1 (stepped B2 islands, turquoise sea) by default; **v2 (smooth ground, depth-blue water, forests, haze) behind `?look=v2`, Ultra level on desktop and Xbox.** |
| UI | **Style E: paper, dark wood, brass, a serif for names.** Same screens as before. |
| Tools | Editors for map, sea, islands, quests, races, sounds, tuning; 10 command-line tools; CI posts screenshot sheets and rule checks. |

## 1. The story

Full reading in [quests.md](quests.md). In short:

- **Good.** One clear spine that never dead-ends, a cast of 15 with voices that hold over 53
  files, ring arcs with real sailing in them, gateways that tell a story in one card, races that
  name a person of every sea. Everything is data and the bots play all of it on three levels.
- **Weak.** The four seas are still one template (letter, bring a ring good, look, bring a ring
  good, supplies, settler); the sea's hazard is never a task. The far goods work in the trade
  (outpost gathers, main port crafts, the ring buys, 0146) but no quest asks for one. After
  four-winds the company has a name and nothing to do; the outposts go quiet in the story. Every
  sea's story waits on Ada's arc and a return to Watchman Key, and nothing tells the player
  ([quests.md](quests.md), point 5, with a data-only fix).
- **Must tidy.** Wren's standing order is offered at Saltmere, her club is at Abbey Head. The
  brief's status line is stale.

Nothing in v1.2, v1.3 or v1.4 touches the story. Since 1.0 the only new story is Wren's club. That
is the biggest gap in the roadmap (section 5).

## 2. Graphics: v1 against v2

Same camera, same place, both looks ([look-v1-v2.jpg](look-v1-v2.jpg): Saltmere's harbour header
and the sea off Saltmere; [westholm-v1-v2.jpg](westholm-v1-v2.jpg): Westholm from the sailing
camera at zoom 2.5).

**v2 is the right direction, and it already looks like a better game.** Land reads as land:
slopes into the sea, a sand band, woods and hedgerows where v1 had empty green planes, fields that
sit on the ground. The water is blue by depth with the turquoise shallows ring kept, which is the
one thing a sailor needs. Towns stay clear of the trees (the art director's rule held). It also
removes a v1 flaw the screenshots show plainly: at overview zoom v1's deep water carries a visible
tiled pattern.

**What v2 must still get right before it becomes the default (#350):**

1. **Silhouette.** B2's stacked sandstone tiers were the islands' signature from the sea; smooth
   ground loses them. Westholm in v2 is a soft green mound. The plan keeps faceted shapes for sea
   stacks, cliffs and volcanoes (`smooth: 0`); the ring's ports need at least one such shape each
   (a cliff face, a knoll) so the four home islands are not four mounds.
2. **Low quality.** Ground triangles went from a few thousand per island to about 615k for the
   game sea on High, 73k on Low. #278 (`?bench`, device gates) must run on a real phone before the
   default flips, not after. Every raise is an argued choice (Guillaume's rule).
3. **The art bible is behind.** Section 2 still says "sea A turquoise" and "B2 highlands"; rule 1
   says flat shading. 0222 says they change when v2 lands. Update them in the same PR as #350.
4. **Every island screenshot in the docs goes stale**, and so do the harbour header pictures
   (`harbour-view.json`). Budget a pass.

## 3. The UI: style E

[ui-style-e.jpg](ui-style-e.jpg): the title menu, the harbour screen, the chart.

**Good.** The skin is coherent and readable, and it no longer reads as a generic web page: the
logbook title menu has personality, the chart on paper is the best screen in the game, the
harbour header finally shows the town, the keeper and the level. The sea HUD keeps knots, heading,
point of sail and the wind always visible, which is what the audience wants.

**Still weak, and not a skin problem.**

1. **The harbour screen is a table under a picture.** The market is a four-row spreadsheet with
   Buy and Sell buttons; the right third of the screen is a small "Order here" box and empty
   paper below it. Two reviews have said "half the screen is empty"; the skin moved the problem
   from navy to cream.
2. **Three UI directions in four releases** (instrument D in 0049, style E in 0220, now #345's
   full console redesign with three new concepts) is a sign that the layout, not the look, is
   what keeps failing to satisfy. #345 is right that trade, people and quests want fullscreen
   modes and that the world should dominate the sailing view.
3. **The quest card** is still a small dialogue box; the journal shows the story after the fact.
   For a game whose charm is its people, the people are small on screen.

Recommendation: do not run #345 as a third restyle. Scope it to the two things that are broken
(the harbour fullscreen modes and a quieter sailing HUD), keep style E's materials and type as the
system, and decide the layout once with mockups of the Market and Quay only. Two of the three
concepts in #345 are new palettes again; Guillaume already rejected palette churn on 2026-10-28.

## 4. The v1.2 plan

Thirteen parts, ten merged or in review (#331 other boats, #268 height field, #269 smooth
ground, #270 sculpting, #271 brushes, #272 terrain CLI, #273 coast checks, #274 depth water, #275
forests, #276 haze), three left (#277 island acceptance, #278 performance gates, #350 default). The plan is well cut (waves, no two threads on the same files, Opus on the engine
parts) and it is moving fast: the hard part is done.

What to watch:

- **#277 and #278 are the release.** Island-by-island acceptance and the device gates are where
  v1.2 either becomes the game or stays a flag. Give them the time the engine parts got.
- **The sculpting line (#270, #271, #272, #352) is authoring, not look.** It is the right
  investment for the editors, but nobody playing the game sees it. It is nearly done; #352 (bake a
  sculpted coast into the outline) can wait for v1.3 without holding the release.
- **#255 has no bugs in it.** Its checklist is empty and no issue carries the `bug` label: there
  are no known bugs, because nobody but Guillaume and the bots has played. Close it, and replace it
  with a playtest by a few strangers before the store build.

## 5. The roadmap

The roadmap page is short and honest ([roadmap.md](../../roadmap.md)): done, now, later, out of
scope. The next three releases are planned as issues already: v1.2 the look, v1.3 the ocean (#279,
waves, boat motion, reflections), v1.4 "Your own boat" (#294, visible upgrades, cosmetics, free
sailing). Then the store plan (0204).

**Three graphics releases in a row, before any player.** The releases follow each other every one
or two weeks and the game is not in any store yet, so the order is not a problem for players. A
strong look is also what sells a store page. The point is what the first store build contains:
between 1.1 and it, the plan adds no new kind of ask and no deeper story, and the weak points found
on 2026-10-25 and again here (one story template, the far goods absent from quests, nothing after
four-winds, the harbour screen as a table) are on no milestone. One short story release (data
only) before the store build closes that.

The second risk is **scope per release.** #279 lists GPU waves, depth-aware foam, boat heave and
roll, bounded gameplay effects and a reflection prototype; #294 lists seven packages with save
migration. v1.2 was cut to 13 issues and still grew (#331, #350, #352). The token rules say 3 to 5
threads and one brief; the trackers for v1.3 and v1.4 each read like two releases.

**How to fix it:** split each tracker into two milestones of 3 to 5 issues, each one shippable on
its own, and add one rule to the start-a-release skill: a release with more than 5 issues, or more
than two of high effort, is split before it starts.

| Today | Split into |
|---|---|
| v1.3 Ocean (#279, 7 issues) | **v1.3 "Waves you can see"**: #280 wave model, #281 coast and shelter, #282 GPU visuals, #286 acceptance. **v1.3.1 "Boats that ride them"**: #283 heave, pitch and roll, #284 effects on sailing and balance. #285 reflections becomes an `idea` issue, decided later with evidence. |
| v1.4 Your own boat (#294, 7 issues) | **v1.4 "Visible upgrades"**: #295 direction, #296 upgrades on the models, #298 saved per ship, #299 shipyard preview. **v1.4.1 "Cosmetics and free sailing"**: #297 catalogue, #300 free sailing, #301 figureheads and acceptance. |

## What is good, what is missing, what must be addressed

**Good**

- The core loop is right for sailing fans and it is finished: wind, towns, people, a home island,
  races, a living sea, sound. 1.0 and 1.1 are real releases people can play today.
- Everything is data with an editor and a command-line tool, checks and bots on three levels, CI
  that posts screenshots. Content is cheap to add and hard to break.
- v2 is clearly better than v1 and nearly there. Style E fixed the "AI-made" look.
- The process works: briefs, milestones, one thread per issue, decisions on file.

**Missing**

- A reason to keep sailing after four-winds and the Cup: the company never acts as one, the
  outposts go quiet in the story, and no quest asks for the far goods.
- A harbour screen that treats trade and people as the main event rather than a table.
- A real device measurement of v2 on Low and of Ultra (#278, #291 still open).
- The store build itself: a playtest by strangers, the first 15 minutes checked, a licence
  decision (the repository is public with no licence file), and what "1.x in the store" contains
  ([consultant.md](consultant.md)).

**Must be addressed, in this order**

1. **Land v1.2 as a look release**: #277, #278, #350 and the art bible update; sculpting may finish
   after.
2. **Close #255 and playtest with strangers** before the store build; their reports become the
   bug list.
3. **Decide the UI layout once.** Scope #345 to the harbour fullscreen modes and the HUD on top of
   style E; no fourth palette.
4. **Put a story release on the roadmap** before or inside v1.4: hazard steps per sea, far-good
   asks, a chapter after four-winds ([quests.md](quests.md), last section). It is data work, the
   cheapest kind this project has.
5. **Split the v1.3 and v1.4 trackers** into two milestones each (table in section 5).

## Where the game should evolve

- **Keep the bet on sailing.** The ocean (v1.3) is the right next big system: waves the boat
  answers to is what a sailor notices first and what the videos will show. Keep it readable and
  optional (motion settings), as #279 already says.
- **Make the islands' people the second pillar in the UI, not only in the data.** Fullscreen
  Quay and quest views with portraits and the actual dialogue, and the harbour screen built round
  them. That is what #345 should become.
- **Give the late game a shape.** One chapter after four-winds that makes the company real (a
  second boat with a standing route, or a captain to hire, or the expedition past the Stormbreak
  as the first paid extension in a sea of its own, which is where pirates were parked). Pick one;
  the quest engine carries any of them.
- **Bring the far-goods trade into the story.** The chain already works (0146); let people ask
  for it: settlers asking for what their outpost gathers, keepers asking for another sea's crafted
  good, standing orders across seas. No automation (0120 holds).
- **Then the stores.** A store build is a product, not a feature: strangers' playtest, onboarding
  tested, a licence, a short trailer from the v2 look. Steam with a web demo first, phones second
  ([consultant.md](consultant.md)).

## Screenshots (main `900b0c9`, desktop; the docs read at `56a9f49`)

- [look-v1-v2.jpg](look-v1-v2.jpg): Saltmere's harbour header and the sea off Saltmere, v1 left,
  v2 right.
- [westholm-v1-v2.jpg](westholm-v1-v2.jpg): Westholm at zoom 2.5, v1 left, v2 right.
- [ui-style-e.jpg](ui-style-e.jpg): title menu, harbour screen, chart in style E.
