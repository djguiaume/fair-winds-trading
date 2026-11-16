# Art director handover (v1.12 to v1.13, 2026-11-16)

v1.12.456 "Light and water" shipped. Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only. Replace this file at the end of your release. Earlier rulings are unchanged: art bible §2, §13, §14 and decisions 0295 to 0300, 0306, 0307.

## 1. What v1.12 settled

- **Art bible §14** holds the rulings: the vibrant top view is the reference atmosphere; one air in both views (option C blue air, fog the same colour, sea dE limit 5 across or away from the sun, 10 into it); storms stay heavier than an overcast day (fog no lighter than `#56666e`); soft-rimmed cumulus in two layers, sun up to 1.8x near the horizon; the squall is a slate wall on the horizon with rain streaks, only when a storm is ahead; sea life fewer, rarer and farther from the boat.
- **Reviews:** sheets in `docs/reviews/v1.12/` (README lists parts and PRs).
- **Habit that worked:** I picked from sheets and gave conditions in one message to each build thread; Guillaume decided only the two atmosphere and sea life points in the brief.

## 2. Open items for v1.13 "Soft and rich"

- **Softness, details, textures** is Guillaume's biggest miss against Saltline (#572, art bible rule 1 changes: procedural surface patterns near the camera, sheet first). Keep the one-atmosphere limit: a new texture must not push the follow sea dE past 5.
- **Known light exception:** open sea at golden hour, follow cam about 6.4 against the 5 limit (wide sun glitter, darker top view under a low sun). Owned by #550; re-check in v1.13 sheets.
- **Squall look, small:** in the final crop the rain streaks are regular like bars and the band floats slightly above the horizon. Not blocking; tidy it if a sky part touches it.
- **Strong-wind follow sea** is the darkest, most muted frame; no further darkening, and fresh wind keeps the top view's blue.
- **Golden-hour sun** sits low in the east at 18:30 game time (daylight quirk, #550 left it).
- **From v1.11/v1.10 (still open):** Westholm millpond and barns, Stonehaven looser than "densest", Abbey Head and Watchman Key unreviewed, far-sea town sheets, title island may cut the town at the right edge, part 3 first voyage and Low quality (#548) sheets not reviewed by me, device round #377/#374/#380.
- **Older:** Fogwatch lantern room, Palm Key level 3 step, Abbey Head club windows and awning, figurehead sun size, Rimewick Low summit spot. Pirates, warships and "cozy fight" rules stay parked.

## 3. Pointers

- Tools: `npm run shots` (`--chase` follow cam, `--both` prints the top vs follow sea dE pass/fail), `npm run chart`, `npm run island -- audit`, `npm run towns`, `npm run life`.
- Find a build thread with `list_threads`, match the session id, and copy the thread id exactly; never send a placeholder message.
