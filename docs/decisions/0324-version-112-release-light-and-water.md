# 0324. Version 1.12 release, Light and water

**Status:** Accepted (2026-11-16). Guillaume validated the review sheets ("Ok") after one review at the end.

## Context

Every part of the [v1.12 brief](../v1.12/brief.md) is merged on `main`: performance budgets and Auto resolution (#557, #558, #549), one atmosphere in both views with the top view as reference ([0318](0318-one-atmosphere-in-both-views.md), #573), light with depth and night (#550, #547, [0319](0319-shadows-you-can-see-from-the-follow-cam-and-contact-shade.md), [0321](0321-the-sun-on-the-sea-through-the-sails-and-in-the-haze-the-gol.md), [0323](0323-night-light-lantern-pools-the-moon-as-key-light-a-moon-path-.md)), a richer sky (#552, [0320](0320-a-richer-sky-two-soft-cloud-layers-weather-driven-squalls-on.md)), waves and open-sea life ([0322](0322-waves-you-can-see-and-life-on-the-open-sea.md), #551, #546), less sea life (#611) and the Saltmere golden-hour fix (#624). Merge rule: every PR auto-merged, one review at the end.

## Decision

- **This is an update.** `package.json` goes to `1.12.0` and the menu label to "1.12" ([0042](0042-light-versioning.md)).
- **The tag** is the version the menu shows for this PR's merge (v1.12.456 if nothing merges first), published with the release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- **Guillaume's review** is one pass over [docs/reviews/v1.12](../reviews/v1.12/README.md).

## Consequences

- Open for later: a phone and tablet `?bench` (#377) and the live title (#531).
- Next is v1.13 "Soft and rich" (#572, #553, #554, #555); #545 (closer top view) is a candidate.
