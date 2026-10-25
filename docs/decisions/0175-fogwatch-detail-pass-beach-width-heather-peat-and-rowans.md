# 0175. Fogwatch detail pass: beach width, heather, peat and rowans

**Status:** Accepted (2026-10-25): the Art director and Guillaume OKed the [review](../reviews/east-sea/README.md#detail-pass-0175).

## Context

Guillaume asked the Art director to compare Fogwatch ([0173](0173-east-sea-fogwatch-the-stepping-stones-and-fog-banks.md)) with Sunreach, now the benchmark. The style matched, but Fogwatch had far less detail: empty turf planes (Sunreach's woods break every surface), flat grey cliffs and a wide pale shelf round the coast that read like concrete, and a loose town.

## Decision

- **Beach width as data:** a coast ground may give `beach` (radius units, default 0.085). Fogwatch's is 0.05, a narrow stony shore. Island builder: the coast ground's **Beach width**; command line: `npm run island -- <id> ground 0 --beach 0.05`.
- **Shore and cliffs:** `greyshingle` is darker (`#5f625f` / `#686b67`); `turf` cliffs take four basalt tones (`#3f434a` to `#74787e`), so the faces jitter like Sunreach's.
- **New props:** `heather` (low purple-brown and olive patches), `peat-stack`, `peat-cutting`, `rowan` (a small tree with red berries), `kale-yard` (a walled garden), `beached-boat` (a boat pulled up on the shore).
- **Fogwatch:** the 17 houses packed in rows along the lanes, turned to face them; kale yards and rowans by the houses; 10 lamp posts along the lanes; boats pulled up and drying racks by the boathouses; heather, boulders, peat stacks, dry-stone walls, cairns and about twice the sheep over the fells. Treeless still: height comes from the fells and cliffs.
- It stays inside the island's 6000-triangle budget (heather is two low blobs).

## Consequences

- Every island can have a narrower or wider beach without code.
- The `fog` islets (the Giant and his Wife, the holms, Broch Isle) take the new cliff tones too.

## Amended (2026-10-25): the waterfall

With rivers in island files ([0176](0176-rivers-of-water-and-lava.md)), Fogwatch has one water river: it rises on the top fell, drops down the four basalt tiers on their town-facing side as a stepped cascade, runs along the ledge above the voe and falls off the sea cliff into the voe by the harbour. It is on the south face so the camera and a player sailing in see it (a Múlafossur-style fall on the north coast would face away from the camera). Two drying racks, four sheep and a peat stack made room in the 6000-triangle budget (5796 at level 4). Data only: `npm run island -- fogwatch river --points …`.
