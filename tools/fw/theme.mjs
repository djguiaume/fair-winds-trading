// `npm run theme` (decisions 0153 and 0269): the UI theme's tokens from the command line, with the
// editors' Theme page's own edits and checks (src/editor/theme/doc.ts).
import { startVite } from './lib.mjs';

export async function run(args) {
  const server = await startVite();
  try {
    const mod = await server.ssrLoadModule('/tools/fw/theme.ts');
    return mod.run(args);
  } finally {
    await server.close();
  }
}
