import { EditorState, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";

const webideTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-content": {
    fontFamily: "monospace",
    padding: "8px 0",
  },
  ".cm-gutters": {
    backgroundColor: "#164e63",
    color: "#67e8f9",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#0e4d5c",
  },
  ".cm-activeLine": {
    backgroundColor: "#164e6311",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "2.5em",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-line": {
    paddingLeft: "4px",
  },
  ".cm-indent-1": { backgroundColor: "#e0f2fe;" },
  ".cm-indent-2": { backgroundColor: "#bae6fd;" },
  ".cm-indent-3": { backgroundColor: "#7dd3fc;" },
  ".cm-indent-4": { backgroundColor: "#38bdf8;" },
  ".cm-indent-5": { backgroundColor: "#0ea5e9;" },
  ".cm-indent-6": { backgroundColor: "#0284c7;" },
  ".cm-indent-error": { backgroundColor: "#ef4444;" },
});

const indentationGuideField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    const tabSize = tr.state.facet(EditorState.tabSize);
    const builder: { from: number; to: number; value: Decoration }[] = [];
    
    for (let i = 1; i <= tr.state.doc.lines; i++) {
      const line = tr.state.doc.line(i);
      const text = line.text;
      let indentSpaces = 0;
      
      for (let col = 0; col < text.length; col++) {
        const char = text[col];
        if (char === '\t') {
          indentSpaces += tabSize;
        } else if (char === ' ') {
          indentSpaces++;
        } else {
          break;
        }
      }
      
      const totalSpaces = indentSpaces;
      const remainder = totalSpaces % 4;
      
      if (text.trim().length > 0 && totalSpaces > 0) {
        for (let i = 0; i < totalSpaces; i++) {
          const isRemainder = i >= totalSpaces - remainder && remainder > 0;
          const levelClass = isRemainder ? "cm-indent-error" : `cm-indent-${Math.min(Math.floor(i / 4) + 1, 6)}`;
          const deco = Decoration.mark({ class: levelClass });
          builder.push({ from: line.from + i, to: line.from + i + 1, value: deco });
        }
      }
    }
    
    builder.sort((a, b) => a.from - b.from);
    return Decoration.set(builder);
  },
  provide: f => EditorView.decorations.from(f),
});

export { webideTheme, indentationGuideField };
