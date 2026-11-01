# Style E type scale (issue #319)

Game CSS (`src/ui/*.css`) takes every font size, family and text colour from the tokens in `src/ui/theme.css`; `tests/type-scale.test.ts` fails on a raw pixel size, font name, hex or rgb text colour, any font size or family that is not a token, letter spacing, or upper-case text (style E is sentence case, no tracking). Faces: Fraunces for titles, names and actions (`--serif`), Barlow for body (`--body`), Barlow Condensed for figures and small labels (`--display`).

| Token | px | Used for |
| --- | --- | --- |
| `--fs-micro` | 11 | map and HUD micro labels, chart tags |
| `--fs-small` | 12 | captions, "Best elsewhere" labels, hold counts |
| `--fs-note` | 13 | hints, chips, lot buttons, quest notes |
| `--fs-body` | 14 | secondary body, list rows |
| `--fs-text` | 15 | body text, goods names, buttons |
| `--fs-lead` | 16 | card text, tab labels, key figures |
| `--fs-sub` | 18 | section heads, dialogue names |
| `--fs-head` | 20 | panel titles |
| `--fs-title` | 24 | sheet and card titles, big figures |
| `--fs-big` | 28 | menu headings, price figures |
| `--fs-display` | 32 | port name, speed figure |
| `--fs-hero` | 44 | title menu |

Outliers moved to the nearest step: 9, 10 to 11; 12.5 to 12; 13.5 to 13; 17 to 16; 19 to 18; 22, 23, 25 to 24; 26, 30 to 28; 34, 38 to 32; 42 to 44.

Left as they are: SVG chart label sizes (`seaChart.ts`, they scale with the map zoom) and the debug FPS readout's monospace face.

Text colours on filled chips are tokens too (`--on-gold`, `--on-green`, `--on-light`, `--on-fill`) and accents on dark plates (`--amber-ink`, `--red-ink`, `--brass-pale`, `--sky-ink`, `--ink-cool`). At night only the paper tokens dim (`--on-fill` stays light), so button text keeps its contrast: ink on paper 6.8:1, light text on teal 6.6:1.

Second pass (v1.4): removed the 35 `text-transform: uppercase` and 49 `letter-spacing` rules left in game CSS; the splash screen now uses `--display`, `--fs-*` and `--on-fill`; the weather text uses `--fs-small`.
