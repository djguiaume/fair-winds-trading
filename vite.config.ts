import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
const revision = git('rev-parse --short HEAD');

// Player-facing version (decision 0042): "0.<phase>" comes from package.json, the last number
// counts the merges on main (first-parent commits), so every deploy goes up by itself.
const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const [major, minor] = version.split('.');
const appVersion = `${major}.${minor}.${git('rev-list --count --first-parent HEAD')}`;

// Relative base so the build works on GitHub Pages (/fair-winds-trading/) and locally.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_REVISION__: JSON.stringify(revision),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    // models.html is the model sheet (decision 0016), published next to the game.
    rollupOptions: {
      input: {
        main: 'index.html',
        models: 'models.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
