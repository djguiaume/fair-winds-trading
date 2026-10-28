# v1.4 — Your Own Boat

Status: scope approved by Guillaume on 2026-10-28; planning only, implementation not started.
Delivery index: [#294](https://github.com/djguiaume/fair-winds-trading/issues/294). No due date.
Seven implementation issues; the small figurehead collection is required scope.

## Goal

Existing boats visibly evolve through their sail, hull and hold upgrades, can be personalized,
and can be tried in a compact temporary Free Sailing session. Keep existing mechanical upgrade
effects unchanged. A base and fully upgraded boat must be distinguishable at the normal sailing
camera while each class remains recognizable.

## Existing commitments and sources

- [Roadmap](../roadmap.md), [history](../roadmap-history.md), [roles](../roles.md).
- v1.2 [#267](https://github.com/djguiaume/fair-winds-trading/issues/267) owns terrain/sculpting, coasts, depth colour, forests,
  atmosphere and its bug-fix work (#255). Its tracker contains scope extensions beyond the original plan.
- v1.3 [#279](https://github.com/djguiaume/fair-winds-trading/issues/279) owns wind/storm/depth waves, boat response, bounded
  gameplay coupling and the conditional reflection gate. Do not duplicate its physical ocean.
- v1.1 #259/#260/#261 retain fixed storms, club races and UI reskin. #291 retains real-device
  Ultra validation. Work in flight is not evidence of release acceptance.
- ADR 0207 supersedes old pirate/combat roadmap phases; steam/logistics and the expedition
  remain separate later directions. ADR 0204 store work remains parked.
- The old optional cosmetics and real sandbox ideas are selected here; achievements and Kids mode are not.

## Approved scope

| Package | Scope | Issue |
| --- | --- | --- |
| 1 | v1.4-1 Visual direction, upgrade identity and compatibility | [#295](https://github.com/djguiaume/fair-winds-trading/issues/295) |
| 2 | v1.4-2 Visible sail, hull and hold upgrades across the fleet | [#296](https://github.com/djguiaume/fair-winds-trading/issues/296) |
| 3 | v1.4-3 Cosmetic catalogue, compatibility validation and editor/CLI authoring | [#297](https://github.com/djguiaume/fair-winds-trading/issues/297) |
| 4 | v1.4-4 Per-ship appearance persistence and save migration | [#298](https://github.com/djguiaume/fair-winds-trading/issues/298) |
| 5 | v1.4-5 Shipyard customization, upgrade comparison and preview | [#299](https://github.com/djguiaume/fair-winds-trading/issues/299) |
| 6 | v1.4-6 Isolated Free Sailing sessions, setup and configuration trials | [#300](https://github.com/djguiaume/fair-winds-trading/issues/300) |
| 7 | v1.4-7 Cosmetic and figurehead collection, fleet review and release acceptance | [#301](https://github.com/djguiaume/fair-winds-trading/issues/301) |

### Upgrade appearance

- Sails: visual cloth treatment, panels, reinforced edges, cut/curvature and class-appropriate rigging detail.
  Fundamental rig type and mechanical effects do not change.
- Hull: readable reinforcement and rubbing strakes, retaining damage/repair feedback.
- Hold: class-appropriate hatches, racks, lashings and storage; do not imply nonexistent usable capacity.
- Preserve all supported mixed upgrades and legacy ship identities; reuse existing upgrade-aware models.

### Personalization

Curated sail colours/patterns, hull trim, personal flags and a small figurehead collection.
Include an unequipped figurehead option, compatible mounts and stable catalogue IDs.
Protect earned regatta pennants and NPC identity. Exact counts/designs, availability and any
proposed prices are design decisions in #295; no paid cosmetics or progression prices are approved.

Everything is data, with editor and matching CLI sharing validation and authoring modules.
One appearance resolver serves gameplay and previews. Persist per owned ship and migrate old saves safely.

### Free Sailing

A distinct temporary session on existing seas with existing ships, upgrades and cosmetics available.
Use small authored safe-spawn and weather presets; share ship configuration and preview with the shipyard.
No quests/story progression, persistent records, new economy system or new maps.
Never write session changes into voyage autosaves, backups, transfers, gold, unlocks or race records.
Pause/suspension and existing hazard/reduced-motion settings retain their contracts.
Document temporary world state and prove lifecycle/storage isolation before shipping.

## Order and ownership

1. #295: representative swift boat and large hauler concepts, compatibility, catalogue size,
   session rules, art approval and ADR. Guillaume approves visuals before fleet-wide production.
2. #296 and #297: rendering and catalogue/authoring with one shared contract; coordinate shared files.
3. #298: per-ship persistence and migration; session isolation contract agreed with #300.
4. #299: shipyard setup/preview on final v1.1 UI; reuse components in #300.
5. #300: compact Free Sailing integration and isolation.
6. #301: finish cosmetic/figurehead content, fleet review, device/regression/release acceptance.

Implementation starts only on a subsequent instruction. No build threads now.
When started: at most 3–5 threads, one owner per shared file; graphify before code work.
PRs say "Fixes #N". No rewrite or general attachment platform is a prerequisite.

## Release gates and sizing

Effort is high and primarily driven by fleet-wide art and mixed-upgrade compatibility.
Do not promise a calendar date before representative concepts/prototype and save/session design.
If the prototype exposes excessive scope, return to Guillaume for a scope decision; do not silently
drop Free Sailing or figureheads from the approved release.

Required: old saves/transfers; unchanged upgrade effects and progression; sailing/docking/races;
catalogue/editor/CLI parity; touch/portrait, keyboard/controller and EN/FR; every graphics tier;
quarter-hull damage and repairs; v1.3 hull attachments and motion controls; no resource leaks after
preview/session changes. Check supported combinations programmatically and visually sample high-risk
cases across every class, day/night and quality tiers. Measure old tablet/phone and desktop/Xbox
against declared startup, frame-time, memory, draw/triangle budgets. Visual approval is explicit.
Run meaningful tests, content checks, lint/build and applicable performance/balance checks.
Release lead completes notes, decisions, roadmap and role handovers.

## Deferred ideas — captured, not scheduled

Each item below is a separate backlog issue, with no milestone or presumed v1.5 commitment.
These are discovery proposals, not approved implementation or changes to current balance.

- [#302](https://github.com/djguiaume/fair-winds-trading/issues/302): Decorative boat attachments at compatible mounting points.
- [#303](https://github.com/djguiaume/fair-winds-trading/issues/303): New upgrade tracks or changes to existing upgrade effects.
- [#304](https://github.com/djguiaume/fair-winds-trading/issues/304): Sail materials with distinct gameplay effects.
- [#305](https://github.com/djguiaume/fair-winds-trading/issues/305): Interchangeable class-compatible sail rigs.
- [#306](https://github.com/djguiaume/fair-winds-trading/issues/306): New playable boat classes and fleet variety.

No new regions, story arcs, achievements, Kids mode, combat, servers, store launch or monetization.
