# The art view after Phase 4 (art director, 2026-10-25)

For the thread "Review the whole game and the roadmap". The art director's full notes and fresh
shots are in `docs/reviews/art-direction/whole-game/README.md` (PR #225). Short version, as given:

1. **Three weakest areas.**
   - **The Windward Ring ports**, where every player starts, were never raised to art bible rule 10.
     Westholm and Saltmere are a few tiny houses on flat green with lone trees and one-tone cliffs;
     Westholm is dark at night (no lit windows, while Sunreach's lanes glow). Port Calda is closer to
     the bar. Fix: a ring catch-up pass on the seas' checklist.
   - **The port screen:** a navy table with half a screen empty, the Quay tab one line on navy; it
     shows nothing of the port. Fix: a header band with the port's signature or vignette and its
     house-palette accent, the keeper's portrait and the town level in the empty space.
   - **Sound:** one ambient bed per sea plus a harbour bell, done with the pirate sounds.
2. **Pirates fit the look:** the reference ad is pirates in this exact style. Keep it cozy by how
   harm is drawn: hits are muzzle puffs (the 0178 smoke), splashes and wood chips, never fire or
   bodies; nothing sinks, a beaten pirate strikes its flag and flees, boarding costs cargo. Pirate
   ships are the existing lines in pirate dress (tar hulls, patched oxblood or charcoal sails, a
   cartoon flag); red stays reserved for pirates. Warships (ketch, brig, frigate) stay style D on the
   shared square rig with painted gun-port bands, navy and brass. Needs: 3 warship models, pirate
   dress and flags as data, effects (puff, ball, splash, chips, struck flag), a pirate cove, a red
   chart and HUD marker, sounds.
3. **Move earlier:** visible hull damage (Guillaume's 2026-10-19 note) into Phase 5, since a chase or
   a fight is unreadable without it; flags as data in Phase 5, which makes cosmetics cheap later.
   First of all: the ring pass and the port header (small, the first impression, independent of
   pirates). Keep later: seasons, sail colours and figureheads, kids art.

4. **Guillaume's two must-haves** (§4 of the art director's notes, with `sheet-ring.jpg`):
   - **Ring review:** island by island at the seas' cameras (town zoom 1.4, overview 2 to 4, night), at
     town levels 1 and 4, Sunreach beside it: shapes, detail per rule 10, lit windows at night, one
     signature per port (Saltmere and Port Calda still need theirs named), arc payoffs visible,
     density per 0180, reefs, borders with the four seas, triangle budget. Top gaps: stacked-octagon
     and straight-extrusion islands; thin, dark towns; flat green caps with lone ball trees, one-tone
     tiers, pebble reefs.
   - **Skerry:** move the choice into the harbour screen as an Island tab; picking a plot turns the
     camera to it behind a half-height panel; the numbered circles become staked plots with a small
     sign; arc rewards end with "Build it at Skerry"; docking at Skerry opens the Island tab.
