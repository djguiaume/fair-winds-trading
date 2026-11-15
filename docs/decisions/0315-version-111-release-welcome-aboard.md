# 0315. Version 1.11 release, Welcome aboard

**Status:** Accepted (2026-11-15). Guillaume validated the review sheets and asked for the release after the painted title was put back ("Leave the static generated image on the title screen for the moment. Then release").

## Context

Every part of the [v1.11 brief](../v1.11/brief.md) is merged on `main`: one HUD in both views, a remembered sailing view and the compact phone HUD (#535, #560); follow-cam framing and look-around (#536, #537, [0312](0312-follow-cam-framing-in-screen-terms-and-look-round-the-boat.md)); one click to sailing and a six-step first voyage (#532, #534, [0311](0311-one-click-to-sailing-and-a-short-first-voyage.md)); the first voyage's opening view (#533, [0313](0313-the-live-title-and-the-first-voyages-opening.md)); the Close-issues workflow and the Low-quality upscale (#569, #548). The live title (#531) is built but parked behind `graphics.title.live`, default off ([0314](0314-the-painted-title-is-back-the-live-title-is-parked-behind-a-.md)). Merge rule: every PR auto-merged, one review at the end.

## Decision

- **This is an update.** `package.json` goes to `1.11.0` and the menu label to "1.11" ([0042](0042-light-versioning.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.11.440 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Guillaume's review** is one pass over [docs/reviews/v1.11](../reviews/v1.11/README.md).

## Consequences

- Open for later: #531 (the live title, switch on when the title picture is replaced), a phone and tablet `?bench` for Low quality and the follow-cam framing (#377), flat light in the follow cam (v1.12).
- Next is v1.12 "Light and water", then v1.13 "Soft and rich" ([review order, #568](../reviews/whole-game-v1.9/README.md)).
