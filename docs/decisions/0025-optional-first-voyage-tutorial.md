# 0025. Optional first-voyage tutorial

**Status:** Implementation for review, requested by Guillaume, 2026-10-19.

## Context

PR #12 (0024) is merged. The automatic practice circuit stays disabled in normal trading. Guillaume asked to implement the next roadmap item: an optional tutorial that introduces chart navigation, sailing/tacking, docking and a first trading delivery. Keep existing voyages and the older-tablet budget.

## Decision

Offer **Start tutorial / Free sailing** after Set sail on a fresh voyage. Escape chooses free sailing too. Do not automatically offer it when loading an existing voyage, including saves from before this feature. Menu has **Learn to sail & trade**, **Continue tutorial** or **Replay tutorial**, according to learning status. The old How to play reference remains available; it no longer automatically interrupts starting play alongside the new offer.

Guide a small, real delivery through nine short lessons:

1. Open the chart. Explain north-up orientation, boat and harbour symbols, and paused planning.
2. Pick any nearby port. Explain that a bearing is not a safe route through land.
3. Lower and raise sails, steer and move a little. Observe real controls/motion; an experienced player can explicitly skip this exercise.
4. Explain the wind/no-go wedge and zigzag tacking. Open the existing optional compass illustration, then continue when ready. Do not force a tack on a downwind route or change the wind for training.
5. Approach the chosen pier, lower sails and dock below the real 1.5-kn limit. Explicit anchor docking and the existing automatic slow-approach docking both count.
6. Buy one unit of a locally produced good using the real Market UI. Existing cargo can be used instead, including with a full hold or no spending money.
7. Choose another port on the chart. Recommend a port that wants the held good, using current data; do not promise a fixed profit.
8. Carry the goods there and dock.
9. Sell at least one unit of the lesson good, or Sell All, using real quotes and transactions. Briefly acknowledge the completed delivery, then return to free exploration.

Use one collapsible, non-modal instruction card, moved into whichever surface is active: the sea HUD, chart or market. It updates only on lesson transitions/edits, and can be hidden or skipped. Do not add a permanent route, minimap, recurring course toast or new 3D object. Hide the card behind menus/help; native introductory/chart/help dialogs pause sailing and release input. The market retains its pause and keyboard focus containment.

## Persistence and recovery

Learning status, lesson, selected port ids and good live in a separate map-specific `fwt.tutorial.v1.*` key. The voyage save key/version/schema and settings format stay unchanged. Accept valid existing saves without migration. Storage failures and malformed tutorial data leave the voyage intact.

Active lessons resume from Menu/Set sail on a loaded voyage; restore the lesson's port bearing from the existing exported pier anchors only when no session destination is already selected. The controls exercise restarts its small input counters on reload. A new voyage restarts any unfinished tutorial at the offer, while remembering completed/skipped choices. Replay resets only learning state, never the boat, wind, time, markets, gold, ships or cargo. Trades remain real and player-triggered, with no grants or bonus rewards.

A destination chosen during a tutorial navigation step belongs to that lesson. Completing/skipping clears that exact destination, without deleting a later personal marker or unrelated destination. Persistent chart pins are untouched. Missing lesson cargo returns to port selection; selling it early returns to buying or uses another held good. Leaving a harbour during its buy/sell lesson returns to its approach lesson. Failed buys, upgrades and ship purchases do not count as tutorial trades.

## Validation and consequences

Tests exercise the controller, actual DOM chart and Captain/Kids trading panels, and the real application wiring with only WebGL rendering stubbed. They cover a complete buy/deliver/sell flow, optional offering for legacy voyages, pause/input release and tacking help, collapsible guidance, replay, reload, malformed/unavailable storage, cargo recovery, destination cleanup and unchanged voyage-save round trips. No new runtime dependency, geometry, texture, shader work or extra animation/render loop. The closed sailing tutorial does no DOM work every frame; active lessons observe a handful of simulation values.

Physical tablet visual/performance checks remain necessary: fresh offer/skip, existing-save menu launch, chart and market in portrait/landscape, text/control overlap, native dialog focus/Escape, repeated hide/show, resume mid-lesson and a complete delivery on Low/Auto. DOM tests do not certify visual layout or sustained device FPS. The prior environment could not install Chromium or reach the local preview from its remote browser; no browser screenshot claim is made here.

Local validation: **118 tests across 14 files pass**, including the application-level tutorial/trading flow with WebGL stubbed; production build, lint/format and diff checks pass.
