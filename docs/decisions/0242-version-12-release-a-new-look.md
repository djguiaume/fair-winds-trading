# 0242. Version 1.2 release, A new look

**Status:** Accepted (2026-10-30).

## Context

Every part of the [v1.2 brief](../v1.2/brief.md) is merged on `main`: the richer other boats
([0231](0231-richer-other-boats.md)), the shared height field and smooth ground
([0235](0235-smooth-island-ground-shore-on-the-coast-faceted-landmarks.md)), saved sculpt edits
([0232](0232-sculpted-terrain-saved-edits-replayed-over-the-height-field.md)), the island builder brushes
([0238](0238-terrain-brushes-in-the-island-builder.md)) and terrain CLI
([0234](0234-terrain-command-line-tool-sculpt-commands-exportimport-and-l.md)), the coast check
([0237](0237-drawn-coast-must-agree-with-the-sailed-coast.md)), depth-coloured water
([0233](0233-depth-coloured-water-from-the-height-fields.md)), instanced forests
([0236](0236-instanced-forests-from-biome-recipes.md)), haze, the per-pixel ground shader
([0239](0239-per-pixel-ground-shader-for-the-new-look.md)) and the new look as the default
([0241](0241-the-new-look-is-the-default-lookv1-keeps-the-classic.md)). All five seas were accepted island by
island by the art director and Guillaume. Scope was set in [0230](0230-v12-scope-terrain-sculpting-and-the-ocean-moves-to-v13.md).
Open by Guillaume's rulings and never blocking: `?bench` re-read on the three real devices, Ultra blanking
the sea on the Xbox (#374, v1.3).

## Decision

- **The update is 1.2.** This PR sets `package.json` to `1.2.0` and the menu label to "1.2", so the menu shows
  `v1.2.<n>` ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The tag** is the version the menu shows for this PR's merge, published with the release workflow and the
  notes in [docs/releases/v1.2.313.md](../releases/v1.2.313.md) ([0062](0062-github-releases-per-phase.md)). If
  another merge lands first, the tag and notes file take the next number.

## Consequences

- The roadmap's "Now" becomes v1.3, "Waves you can see" (#279), then v1.3.1, v1.4, v1.4.1 and the v1.5 story release.
- `?look=v1` keeps the classic look for comparison.
