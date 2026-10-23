/* global process */
/*
 * Writes src/data/islands/<id>.json from today's code (decision 0097), then formats them with
 * Prettier. Run from the repository root: node tools/bake-islands/run.mjs
 */
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { ISLANDS, bakeIsland } = await server.ssrLoadModule('/tools/bake-islands/bake.ts');
  mkdirSync('src/data/islands', { recursive: true });
  for (const island of ISLANDS) {
    const file = `src/data/islands/${island.id}.json`;
    writeFileSync(file, JSON.stringify(bakeIsland(island)) + '\n');
    process.stdout.write(file + '\n');
  }
} finally {
  await server.close();
}
execSync('npx prettier --write src/data/islands', { stdio: 'inherit' });
