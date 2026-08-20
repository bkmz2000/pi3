/**
 * editor/comments.ts: CodeMirror comment annotations — the commentsField
 * resolves each comment's anchor to a live line (original line, then a
 * bounded radius search for the anchor text, else null = orphaned), and
 * re-resolves on document changes. commentExtension wires the gutter,
 * hover, and inline-widget machinery.
 */
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { commentsField, setCommentsEffect, commentExtension, type Comment } from '../../src/editor/comments';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    project_id: 'p1',
    file_path: 'main.py',
    line_number: 2,
    anchor_text: 'print(1)',
    text: 'nice!',
    author_id: 'a1',
    author_name: 'Alice',
    created_at: 1,
    ...overrides,
  };
}

const DOC = 'line one\nprint(1)\nline three\n';

function stateWithComments(comments: Comment[]) {
  // Dispatch a transaction carrying the setCommentsEffect so the field's
  // update() runs resolveAnchor over the current doc.
  const base = EditorState.create({ doc: DOC, extensions: [commentsField] });
  return base.update({ effects: setCommentsEffect.of(comments) }).state;
}

describe('commentsField anchor resolution', () => {
  it('resolves a comment to its original line when the anchor text matches', () => {
    const s = stateWithComments([makeComment()]);
    const resolved = s.field(commentsField);
    expect(resolved[0].resolvedLine).toBe(2);
  });

  it('finds the anchor text at a nearby line when the original moved', () => {
    // Comment points at line 4, but 'print(1)' lives on line 2.
    const s = stateWithComments([makeComment({ line_number: 4 })]);
    const resolved = s.field(commentsField);
    expect(resolved[0].resolvedLine).toBe(2);
  });

  it('marks a comment orphaned (null) when the anchor text is gone', () => {
    const s = stateWithComments([makeComment({ anchor_text: 'nonexistent()' })]);
    const resolved = s.field(commentsField);
    expect(resolved[0].resolvedLine).toBeNull();
  });

  it('re-resolves after a document change (anchors track edits)', () => {
    const s = stateWithComments([makeComment()]);
    // Delete the anchor line; the comment should re-resolve to orphaned.
    const tr = s.update({
      changes: { from: 0, to: DOC.length, insert: 'only one line' },
    });
    const resolved = tr.state.field(commentsField);
    expect(resolved[0].resolvedLine).toBeNull();
  });

  it('a far-out-of-bounds line still finds the anchor text by radius search', () => {
    // line 99 is past the 3-line doc, but the radius search walks outward
    // from that line until it finds the anchor text ('print(1)' on line 2).
    const s = stateWithComments([makeComment({ line_number: 99 })]);
    const resolved = s.field(commentsField);
    expect(resolved[0].resolvedLine).toBe(2);
  });

  it('a comment with anchor text that never exists is orphaned even at a valid line', () => {
    const s = stateWithComments([makeComment({ line_number: 2, anchor_text: 'nope()' })]);
    const resolved = s.field(commentsField);
    expect(resolved[0].resolvedLine).toBeNull();
  });
});

describe('commentExtension', () => {
  it('returns the expected extension pieces', () => {
    const onLineSelect = jest.fn();
    const exts = commentExtension({ canAdd: true, onLineSelect });
    expect(Array.isArray(exts)).toBe(true);
    expect(exts).toHaveLength(6); // 3 fields + gutter + inline plugin + theme
  });

  it('does not crash when creating a view with the extension', () => {
    const onLineSelect = jest.fn();
    const exts = commentExtension({ canAdd: false, onLineSelect });
    const view = new EditorView({
      state: EditorState.create({ doc: DOC, extensions: exts }),
      parent: document.body,
    });
    expect(view.dom).toBeTruthy();
    view.destroy();
  });
});