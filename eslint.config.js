// ESLint flat config. The game is classic browser scripts (no modules):
// content.js defines globals that engine.js reads, and many engine functions
// are called only from inline onclick handlers in the markup, so the
// "unused" and "undefined" rules are tuned for that setup.
const globals = require('globals');

const contentGlobals = {
  SCENARIOS: 'writable', ROLES: 'writable', WILD: 'writable', mapOps: 'writable',
  BOSS_CHAR: 'writable', DIALOGUE: 'writable', BOSS_DIALOGUE: 'writable', TUTORIAL: 'writable',
  BOSS_ID: 'readonly', INSTRUCTOR: 'readonly', LANG: 'writable', applyLang: 'readonly',
};

module.exports = [
  {
    ignores: ['archive/**', 'assets/**', 'qrcode.js', 'node_modules/**', 'docs/**'],
  },
  {
    files: ['content.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': 'off',            // arrays are consumed by engine.js
      'no-undef': 'error',
      'no-dupe-keys': 'error',
    },
  },
  {
    files: ['engine.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...contentGlobals },
    },
    rules: {
      'no-unused-vars': 'off',            // screens and handlers are invoked from markup
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'eqeqeq': ['warn', 'smart'],
    },
  },
  {
    files: ['validate.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      // test/smoke.js evaluates snippets inside the page, so browser and engine
      // globals are legitimate there too.
      globals: { ...globals.node, ...globals.browser, ...contentGlobals,
        S: 'writable', tutorialDone: 'writable', pickTech: 'readonly', pickCounter: 'readonly', finale: 'readonly' },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none' }],
    },
  },
];
