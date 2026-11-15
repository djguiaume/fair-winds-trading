# Art director handover (v1.10 to v1.11, 2026-11-15)

v1.10.74 "Villages" shipped. Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only. Replace this file at the end of your release. Earlier rulings (sky, buoy, sea life, bloom, gusts, ground cover, houses, tones) are unchanged: art bible §2 and decisions 0295 to 0300.

## 1. What v1.10 settled

- **Village rules:** art bible §12 is organic-village rules plus one test: would this pass as a drawing of a real old-European village, judged at the sailing camera. The check now only guards what can break (slope, shore, lava, merging). Decisions 0306 and 0307.
- **Guillaume's picks (2026-11-14):** all three references (Vernazza, Polperro, Cadgwith, in `docs/art/village-references/`), and each town must feel different by biome and industry. The §12 table gives every town its shape and industry cue; if two towns look alike after a recolour, change shape, not colour.
- **Review habit that worked:** top view of the sailing camera judges rows; the follow-cam shots at that distance look alike before and after. Look at every image yourself and name the town in "must fix".
- Night lights, the Ultra moon and follow-cam looks were built by other parts (`docs/reviews/v1.10/`); I did not review those.

## 2. Open items

- **Westholm millpond:** the §12 table asks for one; a pond that fits by the green draws as a sand patch, a bigger one needs two houses' ground. Needs its own plan.
- **Westholm barns and roof tones:** all houses share size and thatch tone. Add a few larger barns and a second roof tone.
- **Stonehaven is looser than "densest stone town":** the narrow shelf and the 0.3W spacing rule cap the core, and no house may stand on the quarry floor. Accepted for v1.10; revisit if Guillaume dislikes it.
- **Not reviewed in detail:** Abbey Head, Watchman Key (too small to judge rows) and the far-sea town sheets in `docs/reviews/v1.10/towns/far-seas.md`.
- **Device round [#377](https://github.com/djguiaume/fair-winds-trading/issues/377):** none of the new looks was measured on a real device. Also open: [#374](https://github.com/djguiaume/fair-winds-trading/issues/374), [#380](https://github.com/djguiaume/fair-winds-trading/issues/380).
- **Next in the order (#568):** v1.11 Welcome aboard (first minute, follow cam). Guillaume wants top and follow views to share atmosphere, light and colours before the follow cam can be default (#573).
- From earlier: UI nits from v1.5, Fogwatch lantern room, Palm Key level 3 step, Abbey Head club windows and awning, figurehead sun size, Rimewick Low summit spot. Pirates, warships and "cozy fight" rules stay parked.

## 3. Pointers

- Sheets: `docs/reviews/v1.10/` and project files `v1.10-review/`.
- Tools: `npm run island -- audit`, `npm run towns`, `npm run shots` (`--look town --zoom 1.4`), `npm run chart`.
- Find a build thread with `list_threads`, match the session id, and copy the thread id exactly; never send a placeholder message.
