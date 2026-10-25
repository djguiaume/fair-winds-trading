# The grown sea as the main game: screenshots

Decision: [0197](../../decisions/0197-the-grown-sea-is-the-main-game.md). Taken with `npm run shots` on the branch, no `?map=` (the game's own sea now).

| Shot | What to see |
|---|---|
| [1-new-game-start-desktop.png](1-new-game-start-desktop.png) | A new game at Saltmere: no dev badge at the bottom any more. |
| [2-chart-new-voyage-desktop.png](2-chart-new-voyage-desktop.png) | The chart of a new voyage: the ring charted, the four seas uncharted parchment, and the market list without the far goods (obsidian, amber, cloudberries, spice…) until a port on the chart sells them. |
| [3-moored-skerry-quest-pill-desktop.png](3-moored-skerry-quest-pill-desktop.png), [landscape](3-moored-skerry-quest-pill-landscape.png), [portrait](3-moored-skerry-quest-pill-portrait.png) | Moored at Skerry with a quest tracked: "⌂ Skerry · your island" now sits under the destination pill instead of behind it. In portrait the pill is at the bottom; the quest note at the top fades after a few seconds. |
| [4-ring-alone-test-desktop.png](4-ring-alone-test-desktop.png) | `?map=ring`: the ring alone, kept as a test sea with its own save and badge. |
| [5-editor-default-desktop.png](5-editor-default-desktop.png) | `editor.html` with no parameter opens the sea editor on the game's sea ("The game's sea" in the picker; "Windward Ring alone" is `?sea=ring`). |
| [6-bench-desktop.png](6-bench-desktop.png) | `?bench` runs its route on the grown sea (frame numbers are the test machine's software renderer, not a device). |

Ring saves and codes are covered by `tests/grown-sea-game.test.ts`: a ring save resumes at the same spot with gold, ships, cargo, markets and quests, the outer seas fogged; a ring FW2 code reads on the grown sea; dev voyages from `?map=phase4` still load.
