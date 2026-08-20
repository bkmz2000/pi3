/**
 * Effect-correctness guards (real source assertions).
 *
 * These used to be expect(true) documentation placeholders. The invariants
 * they describe are statically checkable, so we assert them directly against
 * the source: no react-hooks/exhaustive-deps suppression in the guarded
 * files, and the dependency arrays the fixes introduced are present.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('Effect correctness', () => {
  describe('TeacherProjectView comment-dispatch effect', () => {
    it('has no exhaustive-deps suppression', () => {
      const src = read('src/components/teacher/TeacherProjectView.tsx');
      expect(src).not.toContain('react-hooks/exhaustive-deps');
    });

    it('loads comments with the [projectId, currentFile] dependency array', () => {
      const src = read('src/components/teacher/TeacherProjectView.tsx');
      // The comments effect dispatches the CodeMirror effect inside .then(),
      // keyed on the exact pair that drives re-loads.
      const m = src.match(/getComments\(projectId, currentFile\)[\s\S]{0,400}?\}, \[projectId, currentFile\]\);/);
      expect(m).not.toBeNull();
    });
  });

  describe('SheetEditor (ex-SpriteEditor) effects', () => {
    it('has no react-hooks/exhaustive-deps suppression', () => {
      const src = read('src/SheetEditor.tsx');
      // Allowed suppressions here are react-hooks/immutability for imperative
      // overlay positioning — NOT exhaustive-deps.
      const depsSuppressions = src.match(/eslint-disable-next-line[^\n]*exhaustive-deps/g) || [];
      expect(depsSuppressions).toEqual([]);
    });

    it('unmounts listeners with cleanup (scroll/resize)', () => {
      const src = read('src/SheetEditor.tsx');
      // The canvas-rect invalidation effect removes both listeners in its
      // cleanup function — no leak across mounts.
      expect(src).toMatch(/removeEventListener\("scroll", inv\)/);
      expect(src).toMatch(/removeEventListener\("resize", inv\)/);
    });

    it('recomputes the undo stack once per mount', () => {
      const src = read('src/SheetEditor.tsx');
      // undoHistRef is seeded once with an empty dep array — a remount
      // (rapid reopen) gets a fresh, correct stack.
      expect(src).toMatch(/makeUndoStack\(\); \}, \[\]\)/);
    });
  });
});
