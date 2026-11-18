const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'release/**', 'build/**', 'work/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  { files: ['**/*.cjs'], languageOptions: { ecmaVersion: 2025, sourceType: 'commonjs', globals: globals.node }, rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }] } },
  { files: ['src/*.js'], languageOptions: { ecmaVersion: 2025, sourceType: 'module', globals: globals.browser }, rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['tests/ui/*.cjs'], languageOptions: { globals: globals.browser } }
];
