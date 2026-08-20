/**
 * editor/theme.ts indentationGuideField: builds per-column decoration
 * marks for each leading-space level (levels 1-6, with a remainder
 * highlighted as cm-indent-error when the indent isn't a multiple of 4).
 */
import { EditorState } from '@codemirror/state';
import { indentationGuideField } from '../../src/editor/theme';

function decosFor(code: string) {
  const base = EditorState.create({ doc: code, extensions: [indentationGuideField] });
  // The field builds decorations in update(), so dispatch a no-op transaction
  // to materialize them from the initial doc.
  const state = base.update({}).state;
  return state.field(indentationGuideField);
}

function classes(code: string): string[] {
  const d = decosFor(code);
  const out: string[] = [];
  d.between(0, code.length, (from, to, value) => {
    out.push(`${from}-${to}:${value.spec.class ?? ''}`);
  });
  return out;
}

describe('indentationGuideField', () => {
  it('marks 4 leading spaces as one cm-indent-1', () => {
    expect(classes('    x = 1')).toEqual(['0-1:cm-indent-1', '1-2:cm-indent-1', '2-3:cm-indent-1', '3-4:cm-indent-1']);
  });

  it('marks 8 leading spaces as cm-indent-1 and cm-indent-2', () => {
    const c = classes('        x = 1');
    expect(c).toEqual(['0-1:cm-indent-1', '1-2:cm-indent-1', '2-3:cm-indent-1', '3-4:cm-indent-1', '4-5:cm-indent-2', '5-6:cm-indent-2', '6-7:cm-indent-2', '7-8:cm-indent-2']);
  });

  it('does not decorate a blank line', () => {
    expect(classes('\n')).toEqual([]);
  });

  it('does not decorate unindented code', () => {
    expect(classes('x = 1')).toEqual([]);
  });

  it('highlights a non-multiple-of-4 remainder as cm-indent-error', () => {
    // 6 spaces: 4 normal + 2 remainder flagged
    const c = classes('      x = 1');
    expect(c).toEqual(['0-1:cm-indent-1', '1-2:cm-indent-1', '2-3:cm-indent-1', '3-4:cm-indent-1', '4-5:cm-indent-error', '5-6:cm-indent-error']);
  });

  it('counts a tab as tabSize spaces', () => {
    // Default tabSize is 4 → a single leading tab is 4 spaces = cm-indent-1.
    const c = classes('\tx = 1');
    expect(c).toEqual(['0-1:cm-indent-1', '1-2:cm-indent-1', '2-3:cm-indent-1', '3-4:cm-indent-1']);
  });

  it('caps levels at cm-indent-6 for deep indentation', () => {
    // 28 spaces = 7 levels, capped at 6.
    const c = classes('                            x = 1'); // 28 spaces
    const levelClasses = c.map((s) => s.split(':')[1]);
    expect(levelClasses).toContain('cm-indent-6');
    expect(levelClasses).not.toContain('cm-indent-7');
    expect(c).toHaveLength(28);
  });
});