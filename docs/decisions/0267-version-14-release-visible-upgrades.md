# 0267. Version 1.4 release, Visible upgrades

**Status:** Accepted (2026-11-01).

## Context

Every part of the [v1.4 brief](../v1.4/brief.md) is merged on `main`: the upgrade look, variant B
([0259](0259-visible-upgrade-identity-panels-bands-rubbing-strakes.md), #295), bands on every class
([0262](0262-boat-look-channels-sail-bands-glow-less-figureheads-on-class.md), #296), the cosmetic catalogue
([0261](0261-boat-cosmetic-catalogue-as-data-files.md), #297), each ship's look in the save
([0263](0263-each-ship-keeps-its-own-boat-look-in-the-save.md), #298), the Boat looks screen
([0265](0265-boat-looks-screen-wardrobe-layout-and-turntable-preview.md), #299), logos, patterns, the racing number
on the cloth and wake styles ([0264](0264-sail-marks-on-the-cloth-panel-patterns-and-wake-styles.md), #418), Free
Sailing ([0266](0266-free-sailing-sessions-kept-in-memory-only.md), #300), the collection and fleet acceptance (#301),
the quest ship reward ([0260](0260-quest-ship-reward-and-series-won-start.md), #315) and the text audit (#319).
Guillaume gave the visual OK on every visual PR. Everything is free or earned; nothing is sold.

## Decision

- **This is an update.** `package.json` goes to `1.4.0` and the menu label to "1.4"
  ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge, published with the release workflow and the notes in
  `docs/releases/` ([0062](0062-github-releases-per-phase.md)).

## Consequences

- Upgrades show on every ship; each ship keeps its own look; Free Sailing never touches the voyage.
- Open and never blocking: device `?bench` runs (#377), the Free Sailing preset weather icon (v1.4.1, #357), the quest
  file split (#422). Next: v1.4.1 "Cosmetics and free sailing" (#357), then v1.5 (#358).
