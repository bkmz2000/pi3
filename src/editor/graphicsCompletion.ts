import { type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { pythonLanguage } from "@codemirror/lang-python";
import { DOCS, type DocEntry } from "../docs/graphicsDocs";

function buildCompletions(): Completion[] {
  const completions: Completion[] = [];
  for (const cat of DOCS) {
    for (const entry of cat.entries) {
      completions.push({
        label: entry.name,
        type: entry.name[0] === entry.name[0].toUpperCase() ? "class" : "function",
        detail: entry.signature,
        info: () => buildInfoDOM(entry),
      });
    }
  }
  return completions;
}

function buildInfoDOM(entry: DocEntry): HTMLElement {
  const container = document.createElement("div");
  container.style.cssText = "padding:8px 10px;max-width:320px;font-size:13px;line-height:1.5;";

  const sig = document.createElement("code");
  sig.textContent = entry.signature;
  sig.style.cssText = "display:block;padding:4px 6px;background:rgba(0,0,0,0.15);border-radius:4px;font-size:12px;margin-bottom:6px;white-space:pre-wrap;";
  container.appendChild(sig);

  const desc = document.createElement("p");
  desc.textContent = entry.en;
  desc.style.cssText = "margin:0 0 6px;";
  container.appendChild(desc);

  if (entry.params && entry.params.length > 0) {
    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;width:100%;font-size:12px;";
    for (const p of entry.params) {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.style.cssText = "padding:2px 6px 2px 0;font-weight:600;white-space:nowrap;vertical-align:top;";
      nameCell.textContent = p.name;
      const typeCell = document.createElement("td");
      typeCell.style.cssText = "padding:2px 6px 2px 0;opacity:0.6;white-space:nowrap;vertical-align:top;";
      typeCell.textContent = p.type;
      const descCell = document.createElement("td");
      descCell.style.cssText = "padding:2px 0;vertical-align:top;";
      descCell.textContent = p.en;
      row.appendChild(nameCell);
      row.appendChild(typeCell);
      row.appendChild(descCell);
      table.appendChild(row);
    }
    container.appendChild(table);
  }

  return container;
}

const graphicsCompletions = buildCompletions();

function graphicsCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: graphicsCompletions,
    validFor: /^\w*$/,
  };
}

export const graphicsCompletionExtension = pythonLanguage.data.of({
  autocomplete: graphicsCompletionSource,
});
