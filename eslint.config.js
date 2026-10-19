import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'docs/mockups/src', 'docs/art/src'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
