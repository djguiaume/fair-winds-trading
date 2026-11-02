// `npm run tune` (decisions 0153 and 0268): the tuning numbers from the command line.
import { startVite } from './lib.mjs';

export async function run(args) {
  const server = await startVite();
  try {
    const mod = await server.ssrLoadModule('/tools/fw/tune.ts');
    return mod.run(args);
  } finally {
    await server.close();
  }
}
