# 0174. Fogwatch detail pass: beach width, heather, peat and rowans

**Status:** Proposed (2026-10-25). Waiting on the Art director and Guillaume's look at the [review](../reviews/east-sea/README.md#detail-pass-0174).

## Context

Guillaume asked the Art director to compare Fogwatch ([0173](0173-east-sea-fogwatch-the-stepping-stones-and-fog-banks.md)) with Sunreach, now the benchmark. The style matched, but Fogwatch had far less detail: empty turf planes (Sunreach's woods break every surface), flat grey cliffs and a wide pale shelf round the coast that read like concrete, and a loose town.

## Decision

- **Beach width as data:** a coast ground may give `beach` (radius units, default 0.085). Fogwatch's is 0.05, a narrow stony shore. Island builder: the coast ground's **Beach width**; command line: `npm run island -- <id> ground 0 --beach 0.05`.
- **Shore and cliffs:** `greyshingle` is darker (`#5f625f` / `#686b67`); `turf` cliffs take four basalt tones (`#3f4248` to `#6b6f75`), so the faces jitter like Sunreach's.
- **New props:** `heather` (low purple-brown and olive patches), `peat-stack`, `rowan` (a small tree with red berries), `kale-yard` (a walled garden), `beached-boat` (a boat pulled up on the shore).
- **Fogwatch:** the 17 houses packed in rows along the lanes, turned to face them; kale yards and rowans by the houses; 10 lamp posts along the lanes; boats pulled up and drying racks by the boathouses; heather, boulders, peat stacks, dry-stone walls, cairns and about twice the sheep over the fells. Treeless still: height comes from the fells and cliffs.
- It stays inside the island's 6000-triangle budget (heather is two low blobs).

## Consequences

- Every island can have a narrower or wider beach without code.
- The `fog` islets (the Giant and his Wife, the holms, Broch Isle) take the new cliff tones too.
