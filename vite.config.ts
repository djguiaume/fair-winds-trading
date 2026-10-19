import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';

const revision = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

// Relative base so the build works on GitHub Pages (/fair-winds-trading/) and locally.
export default defineConfig({
  base: './',
  define: { __BUILD_REVISION__: JSON.stringify(revision) },
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
