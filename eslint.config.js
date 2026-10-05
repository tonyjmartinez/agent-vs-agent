import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'artifacts', 'coverage', 'playwright-report', 'test-results'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/engine/**/*.ts', 'src/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'engine/ai must stay pure (no Phaser).' },
            {
              group: ['**/view/**', '**/ui/**', '**/app/**'],
              message: 'engine/ai must not import view/ui/app.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG.' },
        { object: 'Date', property: 'now', message: 'No clocks in engine/ai.' },
      ],
    },
  },
  { files: ['e2e/**/*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
