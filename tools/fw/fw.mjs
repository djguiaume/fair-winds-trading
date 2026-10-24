/* global process, console */
// Command-line tools for agents (decision 0153): `npm run fw -- <tool> [args]`.
// Tools written in TypeScript are loaded through Vite's server-side loader, so they import the
// same modules as the game and the editors (JSON imports and `import.meta.glob` included).
import { parseArgs, startVite } from './lib.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const TOOLS = {
  check: { about: 'every content check: seas, island files, quests', module: '/tools/fw/check.ts' },
  shots: { about: 'standard screenshots of the real game', file: './shots.mjs' },
  balance: { about: 'balance bots on all three difficulty levels', module: '/tools/fw/balance.ts' },
  chart: {
    about: 'labelled map of a sea, PNG + SVG, with an overlay',
    module: '/tools/fw/chart.ts',
  },
  quest: { about: 'quest checks, play a quest from a step', module: '/tools/fw/quest.ts' },
  adr: { about: 'next free decision number, new decision file', file: './adr.mjs' },
};

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  const tool = TOOLS[name];
  if (!tool) {
    console.log('usage: npm run fw -- <tool> [args]   (add --help to a tool for its options)');
    for (const [id, t] of Object.entries(TOOLS)) console.log(`  ${id.padEnd(6)} ${t.about}`);
    process.exit(name ? 1 : 0);
  }
  const args = parseArgs(rest);
  if (tool.file) {
    const mod = await import(tool.file);
    process.exitCode = (await mod.run(args)) ?? 0;
    return;
  }
  const server = await startVite();
  try {
    const mod = await server.ssrLoadModule(tool.module);
    process.exitCode = (await mod.run(args)) ?? 0;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
