# UI components (v1.5, decision 0269)

Every rebuilt screen is made of these; no screen keeps its own button, tab or card style.

| Module            | Makes                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| `button.ts`       | `button({ label, variant: 'primary' \| 'plain' \| 'danger', icon })`      |
| `tabBar.ts`       | `new TabBar({ tabs, selected, onSelect })`, LB/RB glyphs at the ends      |
| `card.ts`         | `card({ title, text, media, selected, onPress })`                         |
| `panel.ts`        | `panel({ edge: 'torn' \| 'plain', night: 'auto' \| 'day' \| 'night' })`   |
| `listRow.ts`      | `listRow({ label, detail, value, icon, selected, onPress })`, 56–64 px    |
| `dialog.ts`       | `new Dialog({ title, text, choices, cancel }).ask()` → the chosen value   |
| `toast.ts`        | `new Toaster().show(text, { kind })`, top centre, two at most, in order   |
| `screenHeader.ts` | `screenHeader({ title, exit: 'back' \| 'close', onExit, legend })`        |

Rules: read only `--ui-*` and `--fs-*` tokens (`src/data/ui/theme.json`, `npm run theme`), never
the style E roles; no CSS filters; the pad hooks are `data-pad-main` (focus starts here),
`data-pad-start="never"` (danger) and `data-pad-close` (header exit). Screens open through the
stack (`src/ui/screens/stack.ts`); motion comes from `src/ui/motion.ts`. The editors' Theme page
shows all eight by day and night.

Presses sound (`uiSound`, decision 0274): `onPress(node, run, sound)` plays `press` unless told, `confirm` on a primary button, `back` on a header exit, `tab` on a tab change, `error` on a soft-disabled control. Moments (banner, stamp, ticks, finish board): `src/ui/moments/`.
