/**
 * no-raw-hex — the design language: no hex color literals outside useTheme.ts.
 *
 * UI chrome colors must come from the theme store (useTheme.ts). Raw hex is
 * only acceptable in files where hex is *data*, not chrome:
 *   - pixel palettes / sprite & tile editors (SheetEditor, KidSheetEditor,
 *     TileEditor, palette.ts)
 *   - canvas pixel colors (matplotlibBlit)
 *   - the CodeMirror syntax theme (editor/theme.ts)
 *   - debug/visualization color arrays (DebugPanel)
 *   - author/avatar color assignment (comments.ts, HandleAvatar)
 *   - Python example strings inside docs (graphicsDocs.ts)
 *   - welcome marketing CSS (WelcomePage / welcome/*) — tokenized in
 *     plan-september-2026.md item #16; remove from the allowlist then.
 *
 * The theme file itself (useTheme.ts) is always allowed.
 */

const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

const noRawHex = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ban raw hex color literals outside useTheme.ts — colors come from the theme store',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowFiles: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.getFilename().replace(/\\/g, '/');
    if (filename.endsWith('useTheme.ts')) return {};

    const options = context.options[0] || {};
    const allow = (options.allowFiles || []).map((s) => s.replace(/^\.\//, ''));
    if (allow.some((a) => filename.includes(a))) return {};

    const report = (node, hex) =>
      context.report({
        node,
        message:
          'Raw hex color "{{ hex }}" — use a theme token from useTheme.ts instead.',
        data: { hex },
      });

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const m = HEX_COLOR.exec(node.value);
        if (m) report(node, m[0]);
      },
      TemplateLiteral(node) {
        if (node.expressions.length > 0) return;
        const cooked = node.quasis.map((q) => q.value.cooked).join('');
        const m = HEX_COLOR.exec(cooked);
        if (m) report(node, m[0]);
      },
    };
  },
};

export default noRawHex;
