import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'workers/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // CDN (jsdelivr) で読み込む Chart.js の UMD グローバル
        Chart: 'readonly',
        // Cowork artifact ランタイムが注入するグローバル
        cowork: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // Node 実行のスクリプト ・ ビルド設定。console/process/fetch 等は Node グローバル。
    files: ['scripts/**/*.mjs', 'scripts/**/*.js', 'vite.config.js', 'vite.accuracy.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Vitest テスト。describe/it/expect/vi 等のテストグローバル + Node + browser。
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        // globals パッケージに vitest 定義が無いため手動
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
];
