import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
const revision = git('rev-parse --short HEAD');

// Player-facing version (decision 0042): "0.<phase>" (since 1.0, "<major>.<update>", 0219) comes from package.json, the last number
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
    // models.html is the model sheet (decision 0016) and editor.html the map editor (decision
    // 0095), both published next to the game; players never load them.
    rollupOptions: {
      input: {
        main: 'index.html',
        models: 'models.html',
        editor: 'editor.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
