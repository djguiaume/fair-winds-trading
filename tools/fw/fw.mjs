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
  island: { about: 'make and change island files, check them', module: '/tools/fw/island.ts' },
  sea: {
    about: "change the Phase 4 sea's files (sea editor), check them",
    module: '/tools/fw/sea.ts',
  },
  chart: {
    about: 'labelled map of a sea, PNG + SVG, with an overlay',
    module: '/tools/fw/chart.ts',
  },
  review: {
    about: 'island review sheets: High and Low, coast chart',
    module: '/tools/fw/review.ts',
  },
  quest: { about: 'quest checks, play a quest from a step', module: '/tools/fw/quest.ts' },
  cosmetics: {
    about: 'boat cosmetics: list, add, edit, check, import, export, preview',
    module: '/tools/fw/cosmetics.ts',
  },
  free: {
    about: 'Free Sailing presets: list, add, edit, check; walk proves the voyage stays untouched',
    file: './free.mjs',
  },
  sound: { about: "the game's sounds into files: effects, sea beds, music", file: './sound.mjs' },
  editorperf: {
    about: "speed of the island builder's terrain brushes on the largest island",
    module: '/tools/fw/editorPerf.ts',
  },
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
