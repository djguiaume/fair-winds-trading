# 0038. Hull damage from any crash

**Status:** Implementation for review, 2026-10-19. Guillaume asked for it in the Phase 1 play-test fixes: crashing into islands, coasts and piers should hurt the hull, not only reefs.

**Context:** [0032](0032-reef-strikes-and-shallows.md) gave ships hull points, a leak that slows a damaged hull, and repairs in any harbour, but only reefs did damage. Ramming an island at full sail was a free bump, and the harbour piers were drawn but not solid: boats sailed through them.

**Decision:**

- **Every hard surface hurts, in proportion to the impact.** Damage follows the speed the impact takes off (head-on loses most, a glancing touch slides along). Reefs keep 6 hull points per knot from the first knot. Rocky shores (round islands and `island` coastlines) and piers cost 5 points per knot beyond a free 2-knot bump, so drifting in to dock (under 1.5 kn) never hurts. A head-on hit at 8 kn takes about 20–25 % of a stock hull, a reef about 40 %.
- **Soft surfaces stay free:** sandbanks (you run aground gently) and the edge of the sea.
- **Piers are solid.** Each harbour pier is a thin segment from the island to its pier head (the same geometry the renderer draws and docks to), so a ship can bump or ram it. When a step touches several things, the hardest decides: reef, then pier, then shore.
- **Feedback:** the existing camera shake on impact, a toast that says what you hit and the hull left ("Ran aground! Hull 78%, repair in port", "Rammed the pier! …"; EN and FR), and the hull pill in the HUD (orange under 50 %). Ramming a pier usually stops you in docking range: the harbour opens with the repair bar on top, and the crash toast replaces the "Docked" toast.
- **Repair is unchanged:** in any harbour, 1.5 gold per point, partly if gold is short. It stays at every port so a damaged ship can always limp home, while upgrades move to the home base ([0030](0030-home-base-upgrades-and-earned-ships.md)). A higher hull upgrade has more points, so the same crash costs a smaller share.
- Later (roadmap): sounds, debris and splash effects, and the boat model showing damage at each 20–25 % of hull lost.
- Ship-to-ship collisions come with other ships (Phase 5); `impactDamage` takes a surface, so they add one more.

**Consequences:** Careless sailing near land now costs gold and speed, which makes lowering sails to dock matter. The Kids-mode hull upgrade text now says the tougher hull helps with bumps and reefs. Knobs in `src/sim/hazards.ts`: `CRASH_SAFE_KN`, `CRASH_DAMAGE` (plus 0032's). Code: `resolveCollisions` returns the hardest surface hit (`src/sim/collision.ts`, also `pierAt` / `piersOf`), `impactDamage` in `src/sim/hazards.ts`, wired in `stepWorld`; no map or save changes.

**Validation:** `tests/hazards.test.ts`: reef > shore > 0 at 8 kn, sandbank and docking-speed bumps free, damage scales with impact speed, a pier is solid and ramming it reports a pier crash. The harbour tests still dock at every pier for both ships, and the rendered pier head matches the collision pier. Checked in the built game with headless Chromium ([screenshots](../screenshots/README.md)).
