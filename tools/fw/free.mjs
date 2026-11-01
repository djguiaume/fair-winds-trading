// `npm run free` (decisions 0153 and 0266): the Free Sailing presets from the command line, and
// `walk`, the isolation proof in the real game. Preset edits share the editor page's module.
import { startVite } from './lib.mjs';
import { walk } from './freeWalk.mjs';

export async function run(args) {
  if (args._[0] === 'walk') return walk(args);
  const server = await startVite();
  try {
    const mod = await server.ssrLoadModule('/tools/fw/free.ts');
    return mod.run(args);
  } finally {
    await server.close();
  }
}
