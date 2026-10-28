# Style E mockups (issue #261, ADR 0220)

*2026-10-28. Static mockups, nothing built.* Each direction is one stylesheet laid over the **real game**
(same layouts, same screens), so only the look changes, as the reskin rule says.

| Direction | Idea | Stylesheet |
| --- | --- | --- |
| A Logbook | Parchment pages, ink, Fraunces serif, wax-seal buttons, taped cards | [a-logbook.css](css/a-logbook.css) |
| B Painted wood and brass | Teal planks, brass rivets, sailcloth cards, chunky brass buttons | [b-wood.css](css/b-wood.css) |
| C Signal flags and enamel | Flat enamel plates, signal-flag stripe and colour coding, white selected row | [c-enamel.css](css/c-enamel.css) |

References and reasoning: `/mnt/project-files/ui-reskin/directions.md` (Skull and Bones, Sea of Thieves,
Seafarer, Pokemon Legends Z-A). No `backdrop-filter` anywhere (old tablets, decision 0006).

## Redraw

```sh
sh build-fonts.sh                       # css/fonts.css (Fraunces, inlined; not committed)
sh shots.sh a-logbook desktop,portrait  # 9 screens + 2 night shots per size, to /tmp/claude-0/s/
python3 sheets.py /tmp/claude-0/s out   # the contact sheets
```

Screens: title menu, new voyage, settings, sea HUD, port Market and Quay, chart, quest card, Xbox focus,
sea and Market at night. Desktop and portrait. The stylesheets are mockup code (`!important` everywhere);
the build would move the tokens into `src/ui/theme.css` and the materials into small SVG frames.

## Round 2 (Guillaume, 2026-10-28)

Guillaume: A has the most personality and looks least AI-made, B has the best HUD, C is too modern and
too "default AI" (yellow/blue). Red confirm buttons and B's plank lines out. Two proposals on A:
[d1](css/d1-paper-teal-buttons.css) paper menu and deep teal buttons, [d2](css/d2-teal-brass-buttons.css)
flat teal menu and frames with paper pages and brass buttons. Both: B's sea HUD (flat dark teal, brass
line), deep teal accents, red only for danger, paper dimmed 20% at night ([night-dim.css](css/night-dim.css)).
`d1-paper.css` and `d2-teal.css` are the three layers concatenated (what `shots.sh` loads).
