# Art director handover (v1.6 to the next release, 2026-11-05)

v1.6.387 shipped. Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only. Replace this file at the end of your release.

## 1. Open decisions

None waiting on Guillaume from the art side. Items below are small and agreed, not blocked.

## 2. Rulings from v1.6 (keep)

- **Sky (#469, #470, PR #478):** look A, clear blue, zenith `#5aa0d4`, horizon `#a6d6ee`, 13 low-poly clouds kept away from the HUD text, chase tilt 11 degrees. Colours are in `graphics.json` > sky. Painted bands (B) read as stripes behind the HUD, soft haze (C) lost the horizon.
- **Quest buoy (#361):** cream hull `#efe6d1` with an ink band and a pale cream-gold lantern. Yellow stays reserved for regatta marks, red for edge buoys.
- **Skerry flag (#361):** star over a wave, cream on navy, at the pier root left of the path, clear of the plot signs. A flag at 2x size swallowed the island; about 1.4x is the limit there.
- **Sea life (#476, PR #480):** gulls about 12 at High, 4 harbour plus 2 wake gulls on Low, never more on phone than desktop. Shoals are a soft blue-grey about a quarter darker than the water, with small fish on top, and drop on Low with the dolphins. Gull and foam colours never above `#f6f9fb`.

## 3. Pointers

- **UI identity:** art bible section 11, decision 0268, `docs/ui-refactor/v1.5/README.md`. Ink on paper, sage `#4a6d41` as the one signature, no red, amber, yellow or brass as UI colour, no pure white, no blur.
- **Sea text:** hard 1 px ink halo, instruments get a faint backing, 11 px floor.
- **Review habits:** judge screens in game, not on mockups. Check phone landscape (844x390), night, and Low against High. Answer in a short list (must fix, good, nice to have). Look at every image yourself. Sheets show every shot at actual size.
- **Upgrade looks, logos, wakes, figureheads:** rules in [boat look rules](../reviews/art-direction/new-look/boats.md); the validator enforces swatch colours.
- **Tools:** `npm run shots`, `npm run chart`, `npm run island`; colours in `src/data/palette.json`, graphics numbers in `graphics.json`.
- **Thread ids:** find a build thread with `list_threads` and copy its id exactly. I could not always find the sender's thread and had to route notes through the release lead. Ask the coordinator for the id up front. Never send a test or placeholder message (I sent two stray ones in v1.6).

## 4. Follow-ups

Open an issue (label `idea`) when one is picked up.

- UI nits from v1.5: Market and Orders leave the bottom about 20% empty on desktop, the Settings Game tab fills only the top third, night quest chips have thin contrast at 12 px, phone lists want an edge fade, the phone quest card sits close to the compass and speed plate.
- Phone: the two toasts stack over the top of the sail in the chase view.
- [#372](https://github.com/djguiaume/fair-winds-trading/issues/372): Rimewick Low's white summit spot, Amber Strand rock pools.
- Fogwatch foghorn tower's lit lantern room, Palm Key level 3 step, Sunreach night windows, Two Palms grass edge.
- Abbey Head club (0227): lit windows at night, café awning and tables; the island is at its mobile budget.
- Figureheads: the sun may still read as a wheel stuck to the hull; make it smaller and tuck it to the stem. Clipper and schooner hulls are still slightly olive at levels 2 to 3.
- Device runs still open: [#374](https://github.com/djguiaume/fair-winds-trading/issues/374), [#377](https://github.com/djguiaume/fair-winds-trading/issues/377), [#380](https://github.com/djguiaume/fair-winds-trading/issues/380).
- Pirates, warships and "cozy fight" rules stay parked for a later extension sea.
