# Storyteller handover to v1.10 (2026-11-12, after v1.9)

From "Storyteller (v1.9)" to the next storyteller thread. Format: [roles.md](../roles.md). Voice, cast and rulings live in the [storyteller brief](storyteller-brief.md); this file says what is open.

## Open decisions

Nothing waits on Guillaume. v1.9 "Believable towns" (v1.9.411) was a look release and ruled no new words. v1.10 redoes every town as an organic old-European village (issue #528). No new person, name or line is needed for that unless a build thread asks.

## Places quests and dialogue rely on (keep in #528)

Rules: never move or rename an island. Quest landing spots, gates and reach points are coordinates in `src/data/quests/*.json`: keep them reachable from open water, move a marker with its shore, then run `npm run quest -- check`. Keep each signature and its `before:`/`after:` tag. Wrecks and hulls are old and empty. Do not change town levels (main ports are Towns, outposts hamlets).

**Ring**
- Saltmere: smokehouse row, net green, Rook's harbour office on the quay (the text only says "call in at the harbour office"; no line gives a position). Before `saltmere-shoals`: boats pulled up, empty racks, cold chimneys. After: smoke, full racks, boats out, buoys on the East Reef gap.
- Port Calda: slipway with a hull on it (after `calda-slipway`), pilot cutter at the pier. Greyback Ridge keeps its pines in sight (the mast is loaded on its shore).
- Westholm: the mill on the hill, bare frames before `westholm-mill`, sails after, never turning.
- Stonehaven: mason's crane, stacked blocks, idle quarry before `stonehaven-light`. Teeth Rock gets the lighthouse after; the old empty hull on the Teeth is gone after.
- Watchman Key (lens pickup, Old Ness) and Abbey Head: no before/after.
- Skerry: the pier (the "dock at Skerry" goal), numbered plot stakes (`buildings.json` `plotCamera`/`homeLooks` follow a plot), the signpost on the pier after `four-winds`.
- Reef names stay: East Reef, the Teeth, The Combs, Mackerel Ledge, The Friars, Bell Rock.

**Far seas**
- Sunreach: tea house; Palm Key outpost.
- Emberhold: Bram's glassworks and chimney on the quay (cold, then glowing after `emberhold-glass`); Black Strand; Cinder Isle outpost.
- Rimewick: jam house with steam, red/ochre/slate timber houses, racks, snowmen; the Lead Rock beacon cairn (tumbled, then lit after `rimewick-jam`); Snowberry Isle weather station, glasshouse footing, moor by the warm spring; Cairn Holm, Seal Rocks.
- Fogwatch: Elias's workshop (shutters, then a lamp after `fogwatch-amber`), the foghorn tower light, Fogwatch Voe; Amber Strand hut, racks and the reach point off its beach; Puffin Holm beacon, Lamb Holm sheep, Gannet Sound north-skerry light.

A new named place (street, chapel, mill) needs the storyteller's ruling in one message. Unnamed houses, fields and trees do not.

## Rules that stay (do not reopen)

- Pirates are out of the base game; if they return, only as a later extension in their own new sea, the "rovers" shape (no guns, you outsail them, nobody is hurt).
- Cosmetics are free or earned, never priced, never power ([customisation.md](customisation.md)). Race text never depends on a storm or mentions the wave slowdown. Races reward pride, not power.
- "Swift" is a ship line id, never a name. Never use "Skerry" in a new name, or a leading word already taken (Cinder, Teeth, Gull, Lantern, Palm, Gannet, Strand).
- Words: warm, plain, "captain" / vous. Every text has EN and FR, NBSP before : ! ? ; and %, FR map names untranslated, no pirates, guns or deadlines in taglines.
- The seas open early (0194). Rook's thanks on the quay stays as approved. The credit load (0200) has no person card, interest or deadline. The big-event panel (0174) stays unbuilt until Guillaume asks.

## Pointers

- Brief: [storyteller-brief.md](storyteller-brief.md); its "Status (2026-10-28)" line is stale, bring it up to date with your first ruling.
- Phase 5 rulings (regatta, standing orders, keepers, Skerry choice): [docs/phase-5/story.md](../phase-5/story.md), decisions 0210, 0213, 0214, 0216, 0217. Built text in `src/i18n` is the truth.
- Town levels and outposts: brief "Town levels in the new seas".

## Follow-ups

- Add a short Wren, regatta and standing-orders section to the brief (today in `docs/phase-5/story.md`). No issue yet.
- Check Bram's voice by ear against Rook's (pitch 0.74, vowels "aeo" against "oau").
