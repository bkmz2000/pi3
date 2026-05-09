import { EditorState, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";

const indentationGuides = EditorView.theme({
  ".cm-indent-1": { backgroundColor: "var(--indent-guide-1)" },
  ".cm-indent-2": { backgroundColor: "var(--indent-guide-2)" },
  ".cm-indent-3": { backgroundColor: "var(--indent-guide-3)" },
  ".cm-indent-4": { backgroundColor: "var(--indent-guide-4)" },
  ".cm-indent-5": { backgroundColor: "var(--indent-guide-5)" },
  ".cm-indent-6": { backgroundColor: "var(--indent-guide-6)" },
  ".cm-indent-error": { backgroundColor: "#ef444466" },
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

export { indentationGuideField, indentationGuides };
