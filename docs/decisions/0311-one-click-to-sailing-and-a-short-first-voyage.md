# 0311. One click to sailing and a short first voyage

**Status:** Accepted (2026-11-15).

## Context

A new player met three clicks and three choices before the boat moved: New voyage, a level card, Set sail, then "Start tutorial or Skip the lessons". The first card read "step 1 of 14", which reads as homework (v1.9 whole-game review, #532, #534). The title also carried six entries.

## Decision

- **New voyage starts at once** on the level the voyage holds (Captain). The title shows a quiet line "Level: Captain, change" that opens the level cards; the level stays in Settings, before and during a voyage.
- **No tutorial question.** A fresh voyage starts its hints, with the harbour's one line as a toast (storyteller ruling, `docs/story/v1.11-rulings.md`). Skip on the first bubble turns the hints off and the story still plays (decision 0160). The offer dialog is removed.
- **Three title rows** (Continue or New voyage, Free Sailing, Settings). How to play and Move your voyage move into Settings › Game, beside the lessons row.
- **The first voyage is six hint steps** (sails, wind, foghorn, wreck, aboard, home), then Rook's two cards. The map is no longer a lesson on the way home.
- **Trading hints are their own quest**, `first-market` (buy, find a buyer, carry, sell), asked once when the first voyage finishes, at Rook's harbour. Same engine, same data files; its words are `market.*`.
- **No "n of 14" counter**; dots count the hints and skip people's cards.
- **Old saves:** a quest file may list `retired` steps; a voyage saved at one carries on at the step named, or finds the quest done (`first-voyage` uses it for the chart and trading steps).

## Consequences

- A fresh browser reaches a moving boat with one click. The tools (`shots`, the performance run, `free walk`) no longer click through the cards.
- Every lesson of the old 14 is still reachable: the sails, wind and rescue in the first voyage, the map and trading at the first market, the rest in Help and the sailing lessons.
- `retired` is a file-only field for now: no editor control, since it only exists to keep old saves readable.
