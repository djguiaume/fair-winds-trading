# 0097. Compare progression directions and defer steam automation

**Status:** Accepted planning constraints, 2026-10-23; the three progression directions are proposals, with no selection or implementation approved.

## Context

The original [sandbox decision](0009-sandbox-short-sessions.md) deferred a campaign. The roadmap made automated sailing fleets the next main goal. Guillaume now wants to compare stronger story/progression motivations and is unconvinced that delegating sailing should define the base game.

Discussion retained three candidates: a modular player harbour island, connecting existing communities, and preparing for an ambitious expedition. A standalone reputation career and a mystery can support these rather than add more competing directions. Guillaume proposed small steam boats for simpler, wind-independent later automation and asked that steam/automation move to a late stage or possible expansion. Player-controlled steam vessels must remain balanced against the existing sailboat lineup. Pirates remain a planned later extension.

## Decision

1. Preserve all three alternatives in the [comparison](../reviews/progression/README.md), including pros, cons, ship roles, current foundations, comparable games, implementation risks and fair prototype/playtest questions. No base direction has been selected.
2. Defer automated transport and steam propulsion to later-stage/possible expansion work. They are not the immediate Phase 3 core objective. Keep existing manual ship ownership, progression and distinct sailing classes. Data/content/authoring work already accepted in [0093](0093-data-driven-content-and-authoring-tools.md) continues.
3. Record [Steam and harbour logistics](../reviews/progression/extensions.md) as a planned later direction: small, slow launches; possible player ownership and piloting; fuel/range/cargo/cost trade-offs; automation evaluated separately. The details are hypotheses, not approved tuning or implementation.
4. Preserve pirates as a separate later extension, with their Settings switch, difficulty scaling and viable avoidance. Island raids and armies are not implicitly included. A base story must be completable without pirates or steam.
5. **No progression when closed.** No elapsed-wall-clock catch-up, offline deliveries, production, construction, income, decay or attacks. Future systems use active simulation time and stop on pause/suspension. This records a design requirement; this documentation change does not claim a runtime audit or modify pause behavior.
6. Expansion/DLC packaging, price, timing and ordering remain open. Paid DLC is not approved.
7. Preserve old saves, transfers, the existing ship models/rigs/upgrades, three graphics levels and the older-tablet target. New requirements and tuning belong in data per ADR 0093.

## Consequences

The roadmap no longer treats automation as the inevitable base-game endpoint. Phase numbers are kept for continuity; version labels are not gameplay acceptance criteria. The base game's next progression milestone needs a subsequent selection decision and scoped implementation PR.

This qualifies the old captain-to-magnate pillar and defers the automated-fleet scope; it does not erase earlier decisions, select a campaign, implement buildings/survival/combat, relocate Saltmere services or reset any voyage.

A narrow prototype should establish whether ownership, relationships or expedition preparation creates the strongest reason for another voyage. Do not implement a large hybrid or either extension merely because it appears in these planning documents.
