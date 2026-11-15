# Art director handover (v1.11 to v1.12, 2026-11-15)

v1.11.440 "Welcome aboard" shipped. Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only. Replace this file at the end of your release. Earlier rulings are unchanged: art bible §2 and decisions 0295 to 0300, 0306, 0307.

## 1. What v1.11 settled

- **Art bible §13** holds the rulings: one HUD in both views (only the view button and Map/Cargo/Menu icons fade, to 40% after 6 s idle); phone landscape HUD pick **A** (lever right, icons bottom-left, mirrored left-handed layout as a Settings option, speed stays the biggest number, point of sail on the compass plate); follow-cam framing pick **B** (hull centre at about 65% height, horizon 40%, 12-20° over the hull at rest, view 54-58°, distance +20-30% eased); live title (paper panel on the left third, morning scene off Saltmere, still on Low); opening at 8 am, heading about 210°.
- **Reviews:** sheets in `docs/reviews/v1.11/` (follow-cam-framing, phone-hud, part3, part4) and project files `v1.11-review/`.
- **Habit that worked:** I picked from sheets and gave conditions in one message to the lead; Guillaume decided only on the framing round.

## 2. Open items for v1.12 "Light and water"

- **Flat morning light:** the opening and the title look right in layout but flat; sun direction, warm key light and depth are the v1.12 job (#550 and #573: top and follow views must share atmosphere, light and colours before the follow cam can be default).
- **Not reviewed by me:** part 3 (first voyage, six steps), part 5 bugs and Low quality (#548); check their sheets in `docs/reviews/v1.11/`.
- **Title:** the island may still cut the town at the right edge after the swing; check the final shot.
- **From v1.10:** Westholm millpond, Westholm barns and a second roof tone, Stonehaven looser than "densest", Abbey Head and Watchman Key unreviewed, far-sea town sheets, device round [#377](https://github.com/djguiaume/fair-winds-trading/issues/377), [#374](https://github.com/djguiaume/fair-winds-trading/issues/374), [#380](https://github.com/djguiaume/fair-winds-trading/issues/380).
- **Older:** Fogwatch lantern room, Palm Key level 3 step, Abbey Head club windows and awning, figurehead sun size, Rimewick Low summit spot. Pirates, warships and "cozy fight" rules stay parked.

## 3. Pointers

- Tools: `npm run shots` (`--chase` for the follow cam), `npm run chart`, `npm run island -- audit`, `npm run towns`.
- Find a build thread with `list_threads`, match the session id, and copy the thread id exactly; never send a placeholder message.
