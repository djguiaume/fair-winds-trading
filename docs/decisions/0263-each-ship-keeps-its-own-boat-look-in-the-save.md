# 0263. Each ship keeps its own boat look in the save

**Status:** Accepted (2026-11-01).

## Context

v1.4 gives each boat a look (ADR 0261 catalogue, `Appearance`). The save must keep it per ship without risking the voyage.

## Decision

- `Captain.looks` / `SaveData.looks`: ship class id to a sparse `Partial<Appearance>` of catalogue ids (never item data). Stock slots are not stored; a ship without an entry wears stock. No owned list: availability is derived from progress by the caller (`CanUse`, default free-only).
- Reading never throws and never checks unlocks: unknown slots, unknown or unfit ids and unowned ships are dropped, so a removed item costs one slot's look, not the voyage. Legacy saves have no `looks`, so `SAVE_VERSION` stays 1.
- Save code (FW2): new optional section 15 after credit, ids written as text so catalogue growth never breaks old codes; FW1 JSON and the `.json` file carry `looks` as is. Older builds read a code with it as "newer".
- Previews live in `LookDraft` (screen state), never in the captain; `apply` / `setShipLook` commit all slots or none. Autosave, transfer and records only see committed looks.

## Consequences

The #299 screen and #418 add slots by extending `Appearance` and the slot order in `saveLooksCode.ts` (append only). Code: `src/sim/shipLooks.ts`, `saveLooksCode.ts`; tests `tests/ship-looks.test.ts`.
