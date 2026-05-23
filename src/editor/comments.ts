import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import type { Extension, Text } from "@codemirror/state";
import { EditorView, GutterMarker, gutter, Decoration, WidgetType, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export interface Comment {
  id: string;
  project_id: string;
  file_path: string;
  line_number: number;
  anchor_text: string;
  text: string;
  author_id: string;
  author_name: string;
  author_handle?: string | null;
  created_at: number;
}

export interface ResolvedComment extends Comment {
  resolvedLine: number | null;
}

export const setCommentsEffect = StateEffect.define<Comment[]>();
const selectLineEffect = StateEffect.define<number | null>();
const hoverLineEffect = StateEffect.define<number | null>();

function resolveAnchor(doc: Text, lineNum: number, anchorText: string): number | null {
  const total = doc.lines;
  const trimmed = anchorText.trim();

  if (lineNum >= 1 && lineNum <= total) {
    if (!trimmed || doc.line(lineNum).text.trim() === trimmed) return lineNum;
  }

  if (trimmed) {
    const maxRadius = Math.max(lineNum - 1, total - lineNum, 200);
    for (let r = 1; r <= maxRadius; r++) {
      for (const cand of [lineNum - r, lineNum + r]) {
        if (cand >= 1 && cand <= total && doc.line(cand).text.trim() === trimmed) return cand;
      }
    }
  }

  return null;
}

export const commentsField = StateField.define<ResolvedComment[]>({
  create: () => [],
  update(comments, tr) {
    for (const e of tr.effects) {
      if (e.is(setCommentsEffect)) {
        return e.value.map(c => ({ ...c, resolvedLine: resolveAnchor(tr.state.doc, c.line_number, c.anchor_text) }));
      }
    }
    if (tr.docChanged && comments.length > 0) {
      return comments.map(c => ({ ...c, resolvedLine: resolveAnchor(tr.state.doc, c.line_number, c.anchor_text) }));
    }
    return comments;
  },
});

const selectedLineField = StateField.define<number | null>({
  create: () => null,
  update(val, tr) {
    for (const e of tr.effects) { if (e.is(selectLineEffect)) return e.value; }
    return val;
  },
});

const hoveredLineField = StateField.define<number | null>({
  create: () => null,
  update(val, tr) {
    for (const e of tr.effects) { if (e.is(hoverLineEffect)) return e.value; }
    return val;
  },
});

// ── Inline comment widget ─────────────────────────────────────────────────────

class CommentInlineWidget extends WidgetType {
  constructor(
    readonly comments: ResolvedComment[],
    readonly selected: boolean,
    readonly lineNum: number,
  ) { super(); }

  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-comment-inline" + (this.selected ? " selected" : "");
    el.dataset.lineNum = String(this.lineNum);
    const c0 = this.comments[0];
    const suffix = this.comments.length > 1 ? `  (+${this.comments.length - 1})` : "";
    const label = (c: Comment) => c.author_handle ? `@${c.author_handle}` : c.author_name;
    el.textContent = `# ${label(c0)}: ${c0.text}${suffix}`;
    el.title = this.comments.map(c => `${label(c)}: ${c.text}`).join("\n");
    return el;
  }

  eq(other: WidgetType) {
    return (
      other instanceof CommentInlineWidget &&
      other.selected === this.selected &&
      other.lineNum === this.lineNum &&
      other.comments.length === this.comments.length &&
      other.comments.every((c, i) => c.id === this.comments[i].id && c.text === this.comments[i].text)
    );
  }

  ignoreEvent() { return false; }
}

// ── Gutter marker (add button on hover) ──────────────────────────────────────

class AddMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-comment-add";
    el.textContent = "+";
    return el;
  }
  eq() { return true; }
}

const addMarker = new AddMarker();

// ── Extension ────────────────────────────────────────────────────────────────

export function commentExtension(opts: {
  canAdd: boolean;
  onLineSelect: (lineNum: number | null, anchorY: number | null) => void;
}): Extension {
  const gutterExt = gutter({
    class: "cm-comment-gutter",

    lineMarker(view, line) {
      if (!opts.canAdd) return null;
      const lineNum = view.state.doc.lineAt(line.from).number;
      if (view.state.field(hoveredLineField) === lineNum) return addMarker;
      return null;
    },

    lineMarkerChange(update) {
      return (
        update.docChanged ||
        update.transactions.some(tr =>
          tr.effects.some(e => e.is(hoverLineEffect))
        )
      );
    },

    domEventHandlers: {
      click(view, line, event) {
        const lineNum = view.state.doc.lineAt(line.from).number;
        const gutterEl = (event.target as HTMLElement).closest(".cm-gutterElement");
        const rect = gutterEl?.getBoundingClientRect();
        const anchorY = rect ? rect.top + rect.height / 2 : (event as MouseEvent).clientY;
        const current = view.state.field(selectedLineField);
        if (current === lineNum) {
          view.dispatch({ effects: selectLineEffect.of(null) });
          opts.onLineSelect(null, null);
        } else {
          view.dispatch({ effects: selectLineEffect.of(lineNum) });
          opts.onLineSelect(lineNum, anchorY);
        }
        return true;
      },
      mousemove(view, line) {
        if (!opts.canAdd) return false;
        const lineNum = view.state.doc.lineAt(line.from).number;
        if (view.state.field(hoveredLineField) !== lineNum) {
          view.dispatch({ effects: hoverLineEffect.of(lineNum) });
        }
        return false;
      },
      mouseleave(view) {
        if (!opts.canAdd) return false;
        view.dispatch({ effects: hoverLineEffect.of(null) });
        return false;
      },
    },
  });

  // Inline widgets placed after the last character of commented lines
  const inlinePlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;

      constructor(view: EditorView) { this.decorations = this.build(view); }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some(tr =>
            tr.effects.some(e => e.is(setCommentsEffect) || e.is(selectLineEffect))
          )
        ) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const comments = view.state.field(commentsField);
        const selectedLine = view.state.field(selectedLineField);
        if (comments.length === 0) return Decoration.none;

        const byLine = new Map<number, ResolvedComment[]>();
        for (const c of comments) {
          if (c.resolvedLine !== null) {
            const arr = byLine.get(c.resolvedLine) ?? [];
            arr.push(c);
            byLine.set(c.resolvedLine, arr);
          }
        }
        if (byLine.size === 0) return Decoration.none;

        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            const lineComments = byLine.get(line.number);
            if (lineComments?.length) {
              const selected = selectedLine === line.number;
              builder.add(
                line.to,
                line.to,
                Decoration.widget({
                  widget: new CommentInlineWidget(lineComments, selected, line.number),
                  side: 1,
                }),
              );
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    {
      decorations: v => v.decorations,
      eventHandlers: {
        mousedown(event: MouseEvent, view: EditorView) {
          const target = event.target as HTMLElement;
          if (!target.classList.contains("cm-comment-inline")) return false;
          const lineNum = parseInt(target.dataset.lineNum ?? "0", 10);
          if (!lineNum) return false;
          const rect = target.getBoundingClientRect();
          const anchorY = rect.top + rect.height / 2;
          const current = view.state.field(selectedLineField);
          if (current === lineNum) {
            view.dispatch({ effects: selectLineEffect.of(null) });
            opts.onLineSelect(null, null);
          } else {
            view.dispatch({ effects: selectLineEffect.of(lineNum) });
            opts.onLineSelect(lineNum, anchorY);
          }
          return true;
        },
      },
    },
  );

  const theme = EditorView.theme({
    ".cm-comment-gutter": { width: "20px", cursor: "pointer" },
    ".cm-comment-gutter .cm-gutterElement": {
      display: "flex", alignItems: "center", justifyContent: "center",
    },
    ".cm-comment-add": {
      width: "14px", height: "14px", borderRadius: "50%",
      background: "rgba(0,120,255,0.15)", color: "#0078ff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "12px", lineHeight: "1", fontWeight: "bold",
    },
    ".cm-comment-inline": {
      marginLeft: "1.5em",
      color: "#c9a227",
      background: "rgba(201, 162, 39, 0.12)",
      borderRadius: "3px",
      padding: "0 6px",
      opacity: "0.85",
      fontSize: "0.88em",
      fontStyle: "italic",
      cursor: "pointer",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "28em",
      display: "inline-block",
      verticalAlign: "middle",
      userSelect: "none",
    },
    ".cm-comment-inline.selected": {
      opacity: "1",
      color: "#e8b800",
      background: "rgba(232, 184, 0, 0.18)",
    },
  });

  return [commentsField, selectedLineField, hoveredLineField, gutterExt, inlinePlugin, theme];
}
