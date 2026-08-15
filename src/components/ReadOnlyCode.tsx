import { useEffect, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { getCmTheme } from '../editor/cmTheme';
import { useThemeStore } from '../state/useTheme';

/**
 * Theme-aware, read-only Python view of a code buffer. Shared by the teacher
 * live-code pane and the session group view. Mirrors the Studio editor's look
 * (font size, github light/dark) but strips every editing affordance.
 */
export function ReadOnlyCode({
  content,
  cursorLine,
  height = '100%',
}: {
  content: string;
  cursorLine?: number | null;
  height?: string;
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
    EditorView.theme({ '&': { fontSize: fontSize + 'px' }, '.cm-cursor': { display: 'none' } }),
  ], [fontSize]);

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
