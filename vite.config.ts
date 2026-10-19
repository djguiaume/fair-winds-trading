import { defineConfig } from 'vitest/config';

// Relative base so the build works on GitHub Pages (/fair-winds-trading/) and locally.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
