import { python } from "@codemirror/lang-python";
import { indentUnit, bracketMatching, indentOnInput } from "@codemirror/language";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  highlightSpecialChars,
  keymap,
} from "@codemirror/view";
import { autocompletion, acceptCompletion, completionKeymap } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";
import { indentationGuideField, indentationGuides } from "./theme";
import { createGraphicsExtensions, type RequestCompletions } from "./graphicsCompletion";
import { commentExtension } from "./comments";
import type { Theme } from "../state/useTheme";

export interface ProfileOpts {
  theme: Theme;
  lang: string;
  fontSize: number;
  cmTheme: Extension;
  enableAutocomplete?: boolean;
  requestCompletions?: RequestCompletions | null;
  onLineSelect?: (lineNum: number | null, anchorY: number | null) => void;
}

// Single instance shared by all profiles so tests can assert inclusion by reference.
export const LINT_GUTTER_EXT = lintGutter();

export function baseProfile(o: ProfileOpts): Extension[] {
  return [
    python(),
    EditorState.tabSize.of(4),
    indentUnit.of("    "),
    bracketMatching(),
    indentOnInput(),
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    highlightSpecialChars(),
    indentationGuideField,
    indentationGuides,
    o.cmTheme,
    EditorView.theme({ "&": { fontSize: o.fontSize + "px" } }),
    EditorView.lineWrapping,
    LINT_GUTTER_EXT,
  ];
}

export function graphicsProfile(o: ProfileOpts): Extension[] {
  return [
    ...baseProfile(o),
    autocompletion({ defaultKeymap: false }),
    ...createGraphicsExtensions(o.theme, o.lang, o.enableAutocomplete ?? true, o.requestCompletions ?? null),
    Prec.high(
      keymap.of([
        { key: "Tab", run: acceptCompletion },
        ...completionKeymap.filter((b) => b.key !== "Enter"),
      ]),
    ),
    commentExtension({ canAdd: false, onLineSelect: o.onLineSelect ?? (() => {}) }),
  ];
}

export function competeProfile(o: ProfileOpts): Extension[] {
  // Same as baseProfile but without lintGutter — the problem editor
  // doesn't run the linter and the empty gutter wastes space.
  return [
    python(),
    EditorState.tabSize.of(4),
    indentUnit.of("    "),
    bracketMatching(),
    indentOnInput(),
    lineNumbers(),
    highlightActiveLine(),
    drawSelection(),
    highlightSpecialChars(),
    indentationGuideField,
    indentationGuides,
    o.cmTheme,
    EditorView.theme({ "&": { fontSize: o.fontSize + "px" } }),
    EditorView.lineWrapping,
  ];
}
