import { defineConfig } from 'vitest/config';

// Relative base so the build works on GitHub Pages (/fair-winds-trading/) and locally.
export default defineConfig({
  base: './',
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
