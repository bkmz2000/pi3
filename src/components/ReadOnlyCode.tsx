import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { getCmTheme } from '../editor/cmTheme';
import { useThemeStore } from '../state/useTheme';

const setSelectedLine = StateEffect.define<number | null>();
const selectedLineField = StateField.define<number | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSelectedLine)) return effect.value;
    }
    return value;
  },
});
const selectedLineDecoration = EditorView.decorations.compute([selectedLineField], (state) => {
    const line = state.field(selectedLineField);
    if (line == null || line < 1 || line > state.doc.lines) return Decoration.none;
    return Decoration.set([
      Decoration.line({ class: 'cm-live-selected-line' }).range(state.doc.line(line).from),
    ]);
});

/**
 * Theme-aware, read-only Python view of a code buffer. Shared by the teacher
 * live-code pane and the session group view. Mirrors the Studio editor's look
 * (font size, github light/dark) but strips every editing affordance.
 */
export function ReadOnlyCode({
  content,
  cursorLine,
  height = '100%',
  selectedLine = null,
  onLineSelect,
}: {
  content: string;
  cursorLine?: number | null;
  height?: string;
  selectedLine?: number | null;
  onLineSelect?: (line: number) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const fontSize = useThemeStore((s) => s.fontSize);
  const cmTheme = getCmTheme(theme);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(() => [
    python(),
    EditorView.lineWrapping,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    selectedLineField,
    selectedLineDecoration,
    EditorView.domEventHandlers({
      click(event, view) {
        if (!onLineSelect) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        onLineSelect(view.state.doc.lineAt(pos).number);
        return true;
      },
    }),
    EditorView.theme({
      '&': { fontSize: fontSize + 'px' },
      '.cm-cursor': { display: 'none' },
      '.cm-live-selected-line': { background: `${theme.accent}22` },
      '.cm-content': { cursor: onLineSelect ? 'pointer' : 'default' },
    }),
  ], [fontSize, onLineSelect, theme.accent]);

  useEffect(() => {
    editorRef.current?.view?.dispatch({ effects: setSelectedLine.of(selectedLine) });
  }, [selectedLine, content]);

  // Keep the reported cursor line in view as the buffer updates.
  useEffect(() => {
    const view = editorRef.current?.view;
    if (!view || cursorLine == null) return;
    try {
      const line = Math.max(1, Math.min(cursorLine, view.state.doc.lines));
      const pos = view.state.doc.line(line).from;
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    } catch {
      /* line out of range mid-update; ignore */
    }
  }, [cursorLine, content]);

  return (
    <CodeMirror
      ref={editorRef}
      value={content}
      height={height}
      theme={cmTheme}
      extensions={extensions}
      editable={false}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        searchKeymap: false,
        autocompletion: false,
        bracketMatching: false,
        closeBrackets: false,
        drawSelection: false,
        dropCursor: false,
        indentOnInput: false,
        allowMultipleSelections: false,
        rectangularSelection: false,
        crosshairCursor: false,
      }}
    />
  );
}

export default ReadOnlyCode;
