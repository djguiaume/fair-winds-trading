# Terrain from the command line

`npm run island -- <id> sculpt …` runs the island builder's terrain brushes ([0232](../decisions/0232-sculpted-terrain-saved-edits-replayed-over-the-height-field.md), [0234](../decisions/0234-terrain-command-line-tool-sculpt-commands-exportimport-and-l.md)). It uses the editor's own `SculptSession` (`src/sim/sculptScript.ts`), so the same strokes in the same order save the same edits.

## Coordinates and units

- Places (`--at`, `--from`, `--to`) are **island-radius units in the file's frame**: x to the right, z toward the harbour, the island's centre at 0,0. A point further than 6 radii from the centre is refused (the longest island, Greyback Ridge, reaches 5).
- `--brush` is the brush radius in the same units (a slope's half width), up to 1.5. (`--radius` is the map radius the checks run at, as for every step.)
- Heights (`--height`, a slope's third number) are world units; ground stays within `sculpt.minHeight` to `maxHeight` in `terrain.json`.
- `--at "x,z x,z …"` is one drag: a dab at each point (points closer than `sculpt.spacing` of the radius to the last are skipped).

## Brushes

| Command | Needs | Effect |
| --- | --- | --- |
| `raise` / `lower` | `--at --brush --strength` | adds / takes `strength` of height per dab at the centre |
| `flatten` | `--at --brush --strength 0..1 --height` | pulls the ground toward the height |
| `smooth` | `--at --brush --strength 0..1` | pulls the ground toward its local average |
| `slope` | `--from x,z,h --to x,z,h --brush --strength 0..1` | an even ramp from one height to the other |

Extra: `--falloff 0..1` (share of the radius that fades; default `terrain.json › sculpt › falloff`), `--override` (edit the ground kept level round buildings and home spots; `npm run check` then fails any building left unlevel).

## Edits in the file

`sculpt list` (numbers each edit), `sculpt remove <n>`, `sculpt reset`, `sculpt export [--to file]` (one line of JSON, `{ version, edits }`), `sculpt import <file> [--append]` (that file, or a whole island file; replaces the edits unless `--append`). The same as data: `--steps '[{"do":"sculpt","op":"raise","at":[[-0.4,-0.3]],"radius":0.25,"strength":1.5}]'` (also `unsculpt`, `sculpt-import`), run after the file's other steps.

Rejected, with the reason and nothing written: another `version`, a missing edits list, an unknown operation, a missing or non-finite number, and edits over the limits in `terrain.json › sculpt › limits` (400 edits, 600 dabs per edit, brush 1.5, reach 6).

## Sample workflow

```sh
npm run island -- new hill --style tropic --seed 7103 --blob r=1,stretch=1.25 --out /tmp/hill.json --radius 40
npm run island -- /tmp/hill.json sculpt raise --at "-0.4,-0.3 -0.3,-0.2" --brush 0.25 --strength 1.5 --radius 40
npm run island -- /tmp/hill.json sculpt flatten --at "-0.35,-0.25" --brush 0.1 --strength 1 --height 6 --radius 40
npm run island -- /tmp/hill.json sculpt slope --from 0.2,0.2,0.5 --to 0.5,0.5,3 --brush 0.1 --strength 1 --radius 40
npm run island -- /tmp/hill.json sculpt list
npm run island -- /tmp/hill.json sculpt export --to /tmp/hill-sculpt.json
npm run island -- other sculpt import /tmp/hill-sculpt.json     # same terrain on another island
```

Coast: an edit that moves the drawn coast (ground height zero) more than `terrain.json › coast › tolerance` from the island file's coast outline, or leaves a building off level ground, fails `npm run check` (`coast`, `support`); `npm run chart -- --coast` draws both coasts (decision 0237).
