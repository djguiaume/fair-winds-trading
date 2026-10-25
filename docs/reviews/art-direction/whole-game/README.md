# Art view for the whole-game review (after v0.4)

The new art director's answers to the thread "Review the whole game and the roadmap" (2026-10-25), before the Phase 5 brief. Nothing here is built until Guillaume picks a Phase 5 direction. Rules: [art bible](../../../art/art-bible.md); open items from the [handover](../../../art/handover.md).

Screenshots (v0.5.0 main, desktop, default level, `npm run shots --look … --zoom 1.4`):

- [sheet-towns.jpg](sheet-towns.jpg): top row Sunreach and Westholm, middle Saltmere and Port Calda, bottom Westholm and Sunreach at night.
- [sheet-port.jpg](sheet-port.jpg): Westholm's port screen, Market and Quay tabs.

## 1. The three weakest areas against the bible (Sunreach the benchmark)

1. **The Windward Ring, where every player starts.** The four seas were raised to rule 10; the ring never was. Westholm and Saltmere at level 1 are a handful of tiny houses on a flat green plane with lone round trees, beaches with no shelf colour, one-tone cliffs. **At night Westholm is dark:** no lit windows, only the pier lamps (Sunreach's lanes glow). The first ten minutes of the game are the plainest part of it. Fix: a ring catch-up pass on the same checklist as the seas (woods instead of lone trees, cliff bands, lanes with lamp posts, gardens and boats, lit windows on every ring house recipe), one port at a time, Sunreach as the bar.
2. **The port screen.** A dark navy table: four rows on Market, then half a screen of nothing; the Quay tab is one line of text on empty navy. It carries none of the port's character, though it is where the player spends a third of the time. Fix (cheap, data driven): a port header band with the port's signature drawn from the scene (or a small rendered vignette of the town at its level), the port's house palette as an accent, and the empty space used for the keeper's portrait and the town's level and next build. Style D stays.
3. **Sound.** Not strictly art, but it is the thinnest part of the presentation: one music theme, creak and foghorn. Each sea deserves an ambient bed (surf, gulls, wind in the rigging, ice creak, lava hiss, sheep) and the harbour a bell. Pirates will need cannon and splash sounds anyway, so it is worth one audio pass with them.

Also seen: the ring's Calda and Abbey Head are closer to the bar (woods, lake, stepped mountain), so the gap is mostly Westholm, Saltmere and Stonehaven.

## 2. Pirates and the storybook look

**It fits.** The game's reference is the *Privateers: Pirate Wars* ad, which is pirates in exactly this bright low-poly style. What keeps it cozy is how threat and harm are drawn, not leaving pirates out:

- **Read the threat by colour and silhouette, not by gore.** Pirate ships are the existing lines in pirate dress: tar-dark hulls, patched oxblood or charcoal sails, a cartoon flag. Red is already reserved for pirates in the bible (amber means storm), so the chart badge, warnings and pirates' night lanterns use red.
- **Hits are splashes, splinters and smoke, never fire or bodies.** A shot is a muzzle puff (the decision 0178 smoke puffs, steam-white), a ball, a white water splash on a miss, a shower of wood chips on a hit. Nothing sinks (decision 0038); a beaten pirate strikes its flag and limps off, a boarded merchant loses cargo, not crew.
- **Warships stay storybook D.** Ketch, brig and frigate on the shared square rig, same proportions as the fluyt and indiaman, with gun ports as a painted band (the indiaman already has them), navy-and-brass colours so the player's warships read as "ours", not as pirates.

What it needs: three warship models (one file each, decision 0077); a pirate dress applied to existing hulls (colours, patched sails, flag) as data; **flags as data** (pirate, naval, each port's colours; the same system later gives cosmetics); effects (muzzle puff, ball, splash, chips, a struck flag); a pirate cove or two in the art of the sea they haunt; visible hull damage (below); a red pirate marker on the chart and HUD; sounds (cannon, splash, bell). Settings switch: pirates off leaves the seas looking the same.

## 3. Roadmap order from the art side

- **Earlier, into Phase 5:** visible damage (Guillaume's 2026-10-19 note: debris and splash on impact, the model changing every 20–25% of hull lost, cleared by repair). Combat is unreadable without it, and reef and coast crashes get it for free. **Flags as data** too: pirates need them, and ship cosmetics then cost little.
- **Before or at the start of Phase 5:** the ring catch-up pass and the port screen header (§1). They are small, they touch the first impression, and they do not depend on the pirate design.
- **Keep later:** seasons (they touch every island and the palette; Phase 7), ship cosmetics beyond flags (sail colours, figureheads; Phase 7, once flags exist), kids-mode art.
- From the handover, still open and worth doing with the ring pass: Fogwatch's lantern room and the main-port 7,500-triangle budget (needs a `?bench` run), Sunreach's upper-lane windows, Palm Key's level-3 step, Emberhold's boulder clusters.
