import { type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { pythonLanguage } from "@codemirror/lang-python";
import { Compartment, StateField } from "@codemirror/state";
import { EditorView, showTooltip, type Tooltip } from "@codemirror/view";
import { DOCS, type DocEntry } from "../docs/graphicsDocs";
import type { Theme } from "../state/useTheme";
import type { JediCompletion } from "../runner/WorkerInterface";

// ─── Lookup map ───────────────────────────────────────────────────────────────

const entryByName = new Map<string, DocEntry>();
for (const cat of DOCS) {
  for (const entry of cat.entries) {
    entryByName.set(entry.name, entry);
  }
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

function buildInfoDOM(entry: DocEntry, lang: string): HTMLElement {
  const loc = lang === "ru" ? "ru" : "en";
  const container = document.createElement("div");
  container.style.cssText = "padding:8px 10px;max-width:320px;font-size:13px;line-height:1.5;";

  const sig = document.createElement("code");
  sig.textContent = entry.signature;
  sig.style.cssText =
    "display:block;padding:4px 6px;background:rgba(0,0,0,0.15);border-radius:4px;font-size:12px;margin-bottom:6px;white-space:pre-wrap;";
  container.appendChild(sig);

  const desc = document.createElement("p");
  desc.textContent = entry[loc];
  desc.style.cssText = "margin:0 0 6px;";
  container.appendChild(desc);

  if (entry.params && entry.params.length > 0) {
    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;width:100%;font-size:12px;";
    for (const p of entry.params) {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.style.cssText =
        "padding:2px 6px 2px 0;font-weight:600;white-space:nowrap;vertical-align:top;";
      nameCell.textContent = p.name;
      const typeCell = document.createElement("td");
      typeCell.style.cssText =
        "padding:2px 6px 2px 0;opacity:0.6;white-space:nowrap;vertical-align:top;";
      typeCell.textContent = p.type;
      const descCell = document.createElement("td");
      descCell.style.cssText = "padding:2px 0;vertical-align:top;";
      descCell.textContent = p[loc];
      row.appendChild(nameCell);
      row.appendChild(typeCell);
      row.appendChild(descCell);
      table.appendChild(row);
    }
    container.appendChild(table);
  }

  return container;
}

function buildCompletions(lang: string): Completion[] {
  return [...entryByName.values()].map((entry) => ({
    label: entry.name,
    type: entry.name[0] === entry.name[0].toUpperCase() ? "class" : "function",
    detail: entry.signature,
    info: () => buildInfoDOM(entry, lang),
  }));
}

function jediTypeToCodeMirror(type: string): string {
  switch (type) {
    case "function": return "function";
    case "class":    return "class";
    case "module":   return "namespace";
    case "keyword":  return "keyword";
    default:         return "variable";
  }
}

function makeJediDotSource(
  requestCompletions: (code: string, line: number, col: number) => Promise<JediCompletion[]>,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return pythonLanguage.data.of({
    autocomplete(context: CompletionContext): Promise<CompletionResult | null> | null {
      const word = context.matchBefore(/\w*/);
      if (!word) return null;
      if (word.from === 0) return null;
      if (context.state.doc.sliceString(word.from - 1, word.from) !== ".") return null;

      const code = context.state.doc.toString();
      const lineObj = context.state.doc.lineAt(context.pos);
      const lineNum = lineObj.number;   // 1-based
      const col = context.pos - lineObj.from; // 0-based

      return new Promise((resolve) => {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          debounceTimer = null;
          if (context.aborted) { resolve(null); return; }
          try {
            const items = await requestCompletions(code, lineNum, col);
            if (context.aborted) { resolve(null); return; }
            const options: Completion[] = items
              .filter((c) => !c.name.startsWith("_"))
              .map((c) => ({
                label: c.name,
                type: jediTypeToCodeMirror(c.type),
                detail: c.description || undefined,
              }));
            resolve(options.length > 0 ? { from: word.from, options, validFor: /^\w*$/ } : null);
          } catch {
            resolve(null);
          }
        }, 300);
      });
    },
  });
}

export type RequestCompletions = (code: string, line: number, col: number) => Promise<JediCompletion[]>;

function makeCompletionExtension(lang: string, requestCompletions: RequestCompletions | null) {
  const completions = buildCompletions(lang);
  const globalSource = pythonLanguage.data.of({
    autocomplete(context: CompletionContext) {
      const word = context.matchBefore(/\w*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;
      // Yield to Jedi on member access
      if (word.from > 0 && context.state.doc.sliceString(word.from - 1, word.from) === ".") return null;
      return { from: word.from, options: completions, validFor: /^\w*$/ };
    },
  });
  if (!requestCompletions) return globalSource;
  return [globalSource, makeJediDotSource(requestCompletions)];
}

export const completionCompartment = new Compartment();

// ─── Signature help ───────────────────────────────────────────────────────────

function getActiveArgIndex(argsText: string): number {
  let depth = 0;
  let index = 0;
  let inStr: string | null = null;
  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    if (inStr) {
      if (ch === "\\") { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) index++;
  }
  return index;
}

function buildSignatureDOM(entry: DocEntry, activeArg: number, theme: Theme, lang: string): HTMLElement {
  const loc = lang === "ru" ? "ru" : "en";
  const params = entry.params ?? [];

  const container = document.createElement("div");
  container.style.cssText = [
    `background:${theme.surfacePanel}`,
    `border:1px solid ${theme.panelBorder}`,
    `border-radius:${theme.radiusCard + 2}px`,
    `box-shadow:0 4px 16px rgba(0,0,0,0.18)`,
    `padding:8px 14px`,
    `font-family:${theme.fontUI}`,
    `font-size:14px`,
    `line-height:1.6`,
    `max-width:480px`,
    `color:${theme.panelTxt}`,
  ].join(";");

  // Signature line
  const sigLine = document.createElement("div");
  sigLine.style.cssText = `font-family:${theme.fontMono};font-size:14px;margin-bottom:${params[activeArg] ? "5px" : "0"}`;

  const nameSpan = document.createElement("span");
  nameSpan.style.fontWeight = "700";
  nameSpan.textContent = entry.name + "(";
  sigLine.appendChild(nameSpan);

  params.forEach((p, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.textContent = ", ";
      sep.style.color = theme.panelTxtMute;
      sigLine.appendChild(sep);
    }
    const paramSpan = document.createElement("span");
    paramSpan.textContent = p.optional ? `${p.name}?` : p.name;
    if (i === activeArg) {
      paramSpan.style.cssText = `font-weight:700;color:${theme.accent};text-decoration:underline;text-underline-offset:2px;`;
    } else {
      paramSpan.style.color = theme.panelTxtMute;
    }
    sigLine.appendChild(paramSpan);
  });

  const closeSpan = document.createElement("span");
  closeSpan.textContent = ")";
  closeSpan.style.fontWeight = "700";
  sigLine.appendChild(closeSpan);
  container.appendChild(sigLine);

  // Active param description
  const activeParam = params[activeArg];
  if (activeParam) {
    const detail = document.createElement("div");
    detail.style.cssText = `font-size:13px;color:${theme.panelTxtMute};`;
    const typePart = document.createElement("span");
    typePart.style.cssText = `font-family:${theme.fontMono};color:${theme.accent};margin-right:4px;`;
    typePart.textContent = activeParam.type;
    detail.appendChild(typePart);
    detail.appendChild(document.createTextNode("— " + activeParam[loc]));
    container.appendChild(detail);
  }

  return container;
}

function getSignatureTooltip(
  state: import("@codemirror/state").EditorState,
  theme: Theme,
  lang: string,
): Tooltip | null {
  const pos = state.selection.main.head;
  const doc = state.doc;
  // Scan back at most 20 lines for the opening paren (handles long arg lists without unbounded lookback)
  const curLine = doc.lineAt(pos).number;
  const startLine = Math.max(1, curLine - 20);
  const lookback = doc.line(startLine).from;
  const text = doc.sliceString(lookback, pos);

  let depth = 0;
  let parenIdx = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ")") depth++;
    else if (ch === "(") {
      if (depth === 0) { parenIdx = i; break; }
      depth--;
    }
  }
  if (parenIdx < 0) return null;

  const before = text.slice(0, parenIdx);
  const match = before.match(/(\w+)$/);
  if (!match) return null;

  const entry = entryByName.get(match[1]);
  if (!entry || !entry.params || entry.params.length === 0) return null;

  const activeArg = getActiveArgIndex(text.slice(parenIdx + 1));

  return {
    pos: lookback + parenIdx,
    above: true,
    strictSide: false,
    arrow: false,
    create() {
      return { dom: buildSignatureDOM(entry, activeArg, theme, lang) };
    },
  };
}

function makeSignatureHelpExtension(theme: Theme, lang: string) {
  return StateField.define<Tooltip | null>({
    create(state) {
      return getSignatureTooltip(state, theme, lang);
    },
    update(value, tr) {
      if (tr.docChanged || tr.selection) return getSignatureTooltip(tr.state, theme, lang);
      return value;
    },
    provide(field) {
      return showTooltip.from(field);
    },
  });
}

export const signatureHelpCompartment = new Compartment();
export const autocompleteThemeCompartment = new Compartment();

function makeAutocompleteTheme(theme: Theme) {
  const bg = theme.surfacePanel;
  const border = theme.panelBorder;
  const text = theme.panelTxt;
  const muted = theme.panelTxtMute;
  const accent = theme.accent;
  const selectedBg = `${accent}22`;
  const radius = `${theme.radiusCard + 2}px`;
  const font = theme.fontUI;
  const mono = theme.fontMono;

  return EditorView.theme({
    // Shared tooltip shell
    ".cm-tooltip": {
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: radius,
      boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
      fontFamily: font,
    },
    // Autocomplete list
    ".cm-tooltip.cm-tooltip-autocomplete": {
      padding: "2px 0",
    },
    ".cm-tooltip-autocomplete ul": {
      fontFamily: font,
      maxHeight: "260px",
    },
    ".cm-tooltip-autocomplete ul li": {
      padding: "3px 10px",
      color: text,
      lineHeight: "1.5",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      background: selectedBg,
      color: text,
    },
    // Label and detail inside each row
    ".cm-completionLabel": {
      color: text,
      fontFamily: mono,
      fontSize: "12px",
    },
    ".cm-completionDetail": {
      color: muted,
      fontFamily: mono,
      fontSize: "11px",
      marginLeft: "6px",
      fontStyle: "normal",
    },
    // The info panel that appears to the right
    ".cm-completionInfo": {
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: radius,
      boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
      color: text,
      fontFamily: font,
      fontSize: "12px",
      padding: "0",
    },
    // Completion type icons
    ".cm-completionIcon": {
      color: muted,
      opacity: "1",
      fontSize: "10px",
      paddingRight: "4px",
    },
    ".cm-completionIcon-function::after":  { content: '"ƒ"', color: accent },
    ".cm-completionIcon-method::after":   { content: '"ƒ"', color: accent },
    ".cm-completionIcon-class::after":    { content: '"⬡"', color: accent },
    ".cm-completionIcon-namespace::after":{ content: '"⬡"', color: accent },
    ".cm-completionIcon-variable::after": { content: '"·"', color: accent },
    ".cm-completionIcon-keyword::after":  { content: '"k"', color: accent },
    // Lint gutter markers
    ".cm-gutter-lint .cm-gutterElement": { padding: "0 2px" },
  });
}

export function createGraphicsExtensions(
  theme: Theme,
  lang: string,
  enabled = true,
  requestCompletions: RequestCompletions | null = null,
) {
  return [
    completionCompartment.of(enabled ? makeCompletionExtension(lang, requestCompletions) : []),
    signatureHelpCompartment.of(enabled ? makeSignatureHelpExtension(theme, lang) : []),
    autocompleteThemeCompartment.of(enabled ? makeAutocompleteTheme(theme) : []),
  ];
}

export function reconfigureGraphicsExtensions(
  theme: Theme,
  lang: string,
  enabled = true,
  requestCompletions: RequestCompletions | null = null,
) {
  return [
    completionCompartment.reconfigure(enabled ? makeCompletionExtension(lang, requestCompletions) : []),
    signatureHelpCompartment.reconfigure(enabled ? makeSignatureHelpExtension(theme, lang) : []),
    autocompleteThemeCompartment.reconfigure(enabled ? makeAutocompleteTheme(theme) : []),
  ];
}
