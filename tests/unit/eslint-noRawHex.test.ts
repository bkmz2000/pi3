/**
 * The no-raw-hex design-language rule: hex colors only in useTheme.ts
 * (or the documented allowlist). See eslint-rules/no-raw-hex.mjs.
 *
 * The rule is plain ESM JS (loaded by ESLint's flat config); jest can't
 * import .mjs in this "type": "module" repo, so we read the source and
 * evaluate it directly — the RuleTester exercises the real rule.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuleTester } from 'eslint';

const ruleSrc = readFileSync(join(__dirname, '../../eslint-rules/no-raw-hex.mjs'), 'utf8');
// `export default noRawHex;` -> `return noRawHex;` inside a function body
const noRawHex = new Function(ruleSrc.replace(/^export default /m, 'return '))();

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: 'module' },
});

ruleTester.run('no-raw-hex', noRawHex, {
  valid: [
    {
      code: 'const c = theme.errorLine;',
      filename: '/webide/src/components/Thing.tsx',
    },
    {
      // the theme file itself is always allowed
      code: "export const studio = { errorLine: '#ef4444' };",
      filename: '/webide/src/state/useTheme.ts',
    },
    {
      // allowlisted files (pixel palettes, docs examples, welcome CSS)
      code: "const palette = ['#1a1c2c', '#5d275d'];",
      filename: '/webide/src/SheetEditor.tsx',
      options: [{ allowFiles: ['SheetEditor', 'pages/WelcomePage'] }],
    },
    {
      code: 'const css = `.cta { color: #7ec98f; }`;',
      filename: '/webide/src/pages/WelcomePage.tsx',
      options: [{ allowFiles: ['SheetEditor', 'pages/WelcomePage'] }],
    },
    {
      // non-color hex (ids, urls) is not flagged
      code: "const url = '#session=abc';",
      filename: '/webide/src/components/Thing.tsx',
    },
    {
      // template literal with expressions is skipped
      code: 'const c = `#${x}fff`;',
      filename: '/webide/src/components/Thing.tsx',
    },
  ],
  invalid: [
    {
      code: "const s = { background: '#fff' };",
      filename: '/webide/src/components/Thing.tsx',
      errors: [{ message: /Raw hex color "#fff"/ }],
    },
    {
      code: "const c = '#ef4444';",
      filename: '/webide/src/components/Thing.tsx',
      errors: 1,
    },
    {
      code: 'const c = `border: 1px solid #f0b429`;',
      filename: '/webide/src/components/Thing.tsx',
      errors: 1,
    },
  ],
});
