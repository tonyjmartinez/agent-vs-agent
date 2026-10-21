import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'artifacts', 'test-results', 'playwright-report', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/engine/**', 'src/ai/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/view/*', '**/ui/*', '**/app/*', 'phaser'] },
      ],
    },
  },
);
