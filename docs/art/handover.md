# Art director handover (end of Phase 4, 2026-10-25)

This is the note for the next art director ("Art director (Phase 5)"). It covers what the first art director thread decided, how it worked and what is still open. Read it together with the [art bible](art-bible.md) (decision [0165](../decisions/0165-art-bible-and-the-phase-4-biome-looks.md)), which holds the rules themselves.

## The role

- Guillaume asked for it on 2026-10-24. The art director keeps the whole game visually coherent.
- Build threads (seas, fills, quests, polish, release review) send it their screenshots and chart before Guillaume sees them. It answers their look questions and talks with the head storyteller where look and story meet.
- **Guillaume gives the final OK on every visual.** The art director's OK means "ready to show Guillaume", never "merged".
- Guillaume's standing instructions to this thread:
  - merge your own PRs once CI is green and the PR is mergeable;
  - he asks questions in each island thread, and those threads ask the art director;
  - document everything you say;
  - compare islands for coherence and detail level.
- The art director's own PRs are docs only (the bible, briefs, review notes). The build threads change the game.

## Where everything lives

| What | Where |
|---|---|
| Rules | [docs/art/art-bible.md](art-bible.md) |
| Decision | [0165](../decisions/0165-art-bible-and-the-phase-4-biome-looks.md) (and its 2026-10-25 update: one detail level) |
| South polish brief | [docs/reviews/art-direction/south/](../reviews/art-direction/south/README.md) |
| Volcano smoke notes, round 1 | [docs/reviews/art-direction/volcano/](../reviews/art-direction/volcano/README.md) |
| Sea density filler kit and budgets | [docs/reviews/art-direction/sea-density/](../reviews/art-direction/sea-density/README.md) |
| Shared-folder copies, side-by-side sheets | `/mnt/project-files/art-director/` (not in git) |
| Colours | `src/data/palette.json` (plus `grounds`, `boulder`/`boulder2` per style) |
| Prop recipes | `src/data/props/*.json` |
| Smoke and vent tuning | `src/data/tuning/weather.json` > `volcano` |

## What the bible now holds

Look for these sections in [the bible](art-bible.md):

- **§3, rules 1–10.** Rule 10: same detail level everywhere, with Sunreach as the benchmark. Compare every port with Sunreach at the same camera (`--look … --zoom 1.4`, plus `--night`).
- **§6, smoke and steam** (decision 0178). Opaque self-lit puffs, warm off-white steam, warm dark ash with an orange underglow at night, puffs that grow then shrink, a camera guard, 8–12 lava bombs per burst. The `vent` prop gives a small live plume (`smoke.ventScale`).
- **§8, the four seas.** Iceland west, Greenland/Svalbard north, Faroe/Scotland east, tropical south.
  - **Where seas meet:** a barrier changes look only at a gap; no mixed coral/basalt reef; no island straddles a border; the tint blends over 60–100 units; every gap gets a landmark.
  - **The sea's edge** (decision 0202): a 60-unit fillet at every corner, buoy turns of at most 30°, no seam markers. Zones that hug the rim continue into a section or fade out at the seam.
- **§9, architecture by sea.** Orange Icelandic lighthouses in the west, a red wooden church in the north, Faroe crofts with brochs and standing stones in the east.

## Decisions taken in review (not all in the bible)

- **Density** (decision 0180, wording fixed in PR #193):
  - no empty disc over r150;
  - empty water at most about 12%, with no minimum;
  - one deliberate open reach (r120–150) per sea;
  - zones don't count as landmarks;
  - marks are at most a third of a sea's fill.
- **Budget per open-water piece:**

  | Piece | Triangles, about |
  |---|---|
  | Stack or skerry | 300 (up to 550 for a banded landmark stack) |
  | Wreck | 400 |
  | Islet | 1,200 |

  Per quarter: at most about 15 pieces and 8,000 triangles.
- **Main ports** stay at 6,000 triangles for now (Fogwatch is right at the limit).
- **No huts on the fills** (the storyteller's rule).
- **Volcano style:** basalt reef rock, never coral, and charcoal boulders with a moss face (decision 0182).

## Open follow-ups

1. **Main-port budget of about 7,500 triangles** (the four main ports only; the tablet is fill-rate bound). Needs a `?bench` run before it changes, because it is a performance rule. Then:
   - give Fogwatch two or three more crofts and dykes on its lowest south shelf;
   - bring back the foghorn tower's lit lantern (Elias's arc payoff). It was dropped because a small lamp box doesn't read, so make it a bigger lantern room.
2. **Kittiwakes:** check that the guano streaks and the bigger, fewer birds landed as asked (east fills, PR #191).
3. **Selkie Rock:** check the last snow-cap tweak landed (off-centre, ragged outline, bigger snow patches, a lighter lower slate band; north corners, PR #192).
4. **Emberhold town grass:** use fewer, bigger boulders in clusters (nice to have).
5. **Palm Key:** add a clear visual step at level 3 (nice to have).
6. **Sunreach at night:** a few more lit windows along the upper lane (nice to have).
7. **First real sea extension:** zones that hug the old rim (the Stormbreak) must continue into the section or fade out at the seam. This is recorded in decision 0202; the art director checks it when it happens.
8. **Portrait shots** of each main port, once (nice to have).

## Review habits that worked

- **Look at every image yourself.** For big sets, make a contact sheet: `montage a.png b.png -tile 3x -geometry 700x440+4+4 sheet.jpg` (ImageMagick is installed).
- **Same camera for every comparison:** town at `--zoom 1.4`, overview at about 2–4, plus one `--night` shot. Sunreach is the benchmark.
- **Recurring flaws to look for:**
  - dark night towns (house recipes without lit windows);
  - large empty green or grey planes;
  - flat one-tone cliffs (they need colour bands);
  - a wide grey coastal shelf;
  - regular polygons that read as man-made (snow caps, marram tops);
  - small white details that read as litter at the game camera (birds, flecks).
- **Answer in a short list:** must fix, good, nice to have, and say exactly what goes to Guillaume and when. When the fixes are small, trust the thread and skip another round ("no need to send back").
- **Messages to threads are capped at 2,000 characters.** For longer notes, write a file under `/mnt/project-files/art-director/…` (and later into `docs/reviews/art-direction/`) and send a short summary with the path.
- **Find a thread's id with `list_threads` before you send.** Match the relay's session id to the thread. Never send a test or "placeholder" message; this thread misrouted several and had to apologise.
- **Ask the storyteller first** where a look carries story (port signatures, arc payoffs, what may be built on a fill).

## Thread map at handover

The old Phase 4 build threads (west, north, east, storm belt, south polish, quarters, volcano, density and fills, release review) are done or nearly done. New work starts in new threads; ask the coordinator for the current list. The head storyteller is "Head storyteller (Phase 4)", or its successor.
