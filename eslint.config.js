import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // The reason this config exists. Several bugs in this app were stale closures and missing
      // effect dependencies — a tick reading state from the render it was created in, an effect
      // that never saw an updated task name. This rule catches that class mechanically.
      //
      // It is a warning, not an error: the timers deliberately omit some dependencies. The
      // countdown effect depends only on `isRunning` so the interval is not torn down and
      // rebuilt on every tick, and the zero-detection effects deliberately leave their handler
      // out to avoid re-running on every render. Those omissions are load-bearing and
      // commented at each site, so this reports them for review rather than failing the build.
      'react-hooks/exhaustive-deps': 'warn',

      // `catch {}` with an explanatory comment is the established idiom here for localStorage
      // and Web Audio calls that are allowed to fail.
      'no-empty': ['error', { allowEmptyCatch: true }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Config and scripts run in Node, not the browser.
    files: ['vite.config.ts', 'eslint.config.js', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  }
);
