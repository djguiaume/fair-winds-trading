import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'docs/mockups/src',
      'docs/ui-refactor/mockups/src',
      'docs/ui-refactor/style-e/js',
      'docs/ui-refactor/v1.6',
      'docs/reviews/*/src',
      'docs/reviews/**/src',
      'docs/art',
      'docs/quest-builder/mockup',
      'docs/roadmap-image',
      'tools/ship-models',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
