import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noRawHex from './eslint-rules/no-raw-hex.mjs'

export default defineConfig([
  globalIgnores(['dist', 'dist-server', '.tsbuild', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      local: { rules: { 'no-raw-hex': noRawHex } },
    },
    rules: {
      // v7 rules that flag intentional patterns used throughout this codebase
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      // Conventional: parameters prefixed with _ are intentionally unused.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Design language: colors come from useTheme.ts, never raw hex.
      'local/no-raw-hex': ['error', {
        allowFiles: [
          // pixel palettes / sprite & tile editors — hex is data, not chrome
          'SheetEditor', 'KidSheetEditor', 'TileEditor', 'palette.ts',
          // canvas pixel colors
          'matplotlibBlit',
          // CodeMirror syntax theme
          'editor/theme.ts',
          // debug visualization color arrays
          'DebugPanel',
          // author/avatar color assignment (data)
          'comments.ts', 'HandleAvatar',
          // Python example strings inside docs
          'docs/graphicsDocs',
          // test fixtures/assertions (raw color values are data, not chrome)
          'tests/',
          // marketing CSS — tokenize in plan item #16, then drop this entry
          'pages/WelcomePage', 'pages/welcome', 'ExamplesGalleryPage',
        ],
      }],
    },
  },
])