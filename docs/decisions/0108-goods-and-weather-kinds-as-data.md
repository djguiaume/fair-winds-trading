# 0108. Goods and weather kinds as data

**Status:** Implemented for review (2026-10-23). Requested by Guillaume; step 3 of [0093](0093-data-driven-content-and-authoring-tools.md) ("content as data"), with the ship files in a follow-up.

## Context

[0094](0094-tuning-moved-to-data.md) moved the numbers of goods and weather kinds to JSON but kept their **ids** in TypeScript (`RAW_GOODS`, `SPECIALTY_GOODS`, `RARE_GOODS`, `WEATHER_KINDS`), so a new good or weather kind still needed code. Guillaume wants to add content himself.

## Decision

1. **Goods.** `GOODS` is the list of keys of `src/data/tuning/goods.json`, in file order, and each good has a `kind`: `raw`, `made` (with `madeFrom`) or `rare`. `RAW_GOODS`, `SPECIALTY_GOODS` and `RARE_GOODS` are filtered from it. `GoodId` is typed from the file's keys, so TypeScript still checks good ids in code.
2. **Weather kinds.** The kinds are the keys of `default.kinds` in `weather.json`; the weighted pick runs in file order, which was reordered to the old code order (calm, breeze, rain, gale) so every voyage keeps the same weather. Each kind gets a `name` and a `gloom` (sky darkening: 0.25 for the gale, which was the hard-coded `kind === 'gale'` in the renderer). `breeze` stays the plain weather in code (`USUAL_WEATHER`): voyages start in it, the HUD hides it, maps without kinds keep it; difficulty levels still move weight between it and `gale`.
3. **Names fall back to the data.** `goodName` and the new `weatherName` use the translation when `src/i18n/*.json` has one, else the file's `name`. A made good without its own workshop name reads "a workshop" (`workshop.any`).
4. **Proof.** `tests/content-as-data.test.ts` adds a good (salt) and a weather kind (fog) to the files only and checks they exist, are named, saved and come up at sea. The 0094 "same values" test now also checks the derived lists and gloom.
5. How to add content: [docs/content/README.md](../content/README.md).

## Consequences

- No gameplay change: same goods in the same order, same weather on every seed, same sky.
- A new good still needs a maker and buyers on the map (map editor) and, ideally, translations; the map checks flag a good that is wanted but made nowhere, or made but never wanted.
- A weather kind with a new look (fog, snow) still needs render code once; a new kind otherwise looks like its rain and gloom.
