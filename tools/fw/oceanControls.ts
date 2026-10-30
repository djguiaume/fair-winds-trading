// `npm run sea -- waves` (decision 0250): the ocean controls of the `?tune` panel's Waves tab and
// the levels' Waves defaults, listed by what they change, and set with the panel's own edits
// (src/data/oceanControls.ts over tuningEdits.ts), written the way its Export writes them.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type OceanEffect, oceanControls, setOceanControls } from '../../src/data/oceanControls';

const HEADINGS: Record<OceanEffect, string> = {
  sea: 'Sea (the wave field everything floats on; same on every level and frame rate)',
  drawing: 'Drawing (how the ocean draws and shades it)',
  comfort:
    'Comfort (boat and camera motion on screen; Settings › Gentle sea motion, Camera rides the waves)',
  level: 'Levels (Waves on by default; Settings › Waves overrides it)',
  review: 'Review seas (?waves=calm|wind|storm)',
};

type Args = Record<string, string | boolean | undefined> & { _: string[] };

/** `waves [path=value …] [--dry] [--json]`: list, or set and write. No sailing rule reads any. */
export function wavesCommand(args: Args, root: string): number {
  const pairs = args._.slice(1);
  if (pairs.length) {
    let files;
    try {
      files = setOceanControls(pairs);
    } catch (e) {
      console.log(`✗ ${(e as Error).message} (nothing written)`);
      return 1;
    }
    if (!args.dry) for (const f of files) writeFileSync(resolve(root, f.path), f.text);
    const names = files.map((f) => f.path.replace('src/data/', '')).join(', ');
    console.log(`${pairs.join('; ')}; ${args.dry ? 'would write' : 'wrote'} ${names || 'nothing'}`);
    return 0;
  }
  const rows = oceanControls();
  if (args.json) {
    console.log(JSON.stringify(rows, null, 1));
    return 0;
  }
  for (const effect of Object.keys(HEADINGS) as OceanEffect[]) {
    console.log(HEADINGS[effect]);
    for (const r of rows.filter((row) => row.effect === effect))
      console.log(`  ${r.path} = ${JSON.stringify(r.value)}  (${r.label})`);
  }
  return 0;
}
