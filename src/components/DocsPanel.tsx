import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Theme } from "../state/useTheme";
import { DOCS, type DocCategory, type DocEntry } from "../docs/graphicsDocs";
import { Icon } from "./Icons";

function PanelHeader({ title, theme, onClose }: { title: string; theme: Theme; onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        background: theme.panelHeader,
        borderBottom: `1px solid ${theme.panelBorder}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: theme.fontUI, fontWeight: theme.weightHeader, fontSize: 13, color: theme.panelTxt }}>
        {title}
      </span>
      <button
        type="button"
        onClick={onClose}
        style={{
          all: "unset",
          cursor: "pointer",
          color: theme.panelTxtMute,
          display: "flex",
          alignItems: "center",
          padding: 2,
          borderRadius: 3,
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

function ParamTable({ entry, lang, theme }: { entry: DocEntry; lang: string; theme: Theme }) {
  const { t } = useTranslation();
  const isRu = lang.startsWith("ru");
  if (!entry.params || entry.params.length === 0) return null;

  const col: React.CSSProperties = {
    padding: "4px 8px",
    fontFamily: theme.fontMono,
    fontSize: 11,
    color: theme.panelTxt,
    borderBottom: `1px solid ${theme.panelBorder}`,
    verticalAlign: "top",
  };
  const colMute: React.CSSProperties = { ...col, color: theme.panelTxtMute };
  const colHead: React.CSSProperties = {
    ...col,
    fontFamily: theme.fontUI,
    fontWeight: theme.weightHeader,
    fontSize: 11,
    color: theme.panelTxtMute,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: `1px solid ${theme.panelBorder}`,
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontFamily: theme.fontUI, fontWeight: theme.weightHeader, fontSize: 11, color: theme.panelTxtMute, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {t("docs.params")}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...colHead, textAlign: "left" }}>{t("docs.name")}</th>
            <th style={{ ...colHead, textAlign: "left" }}>{t("docs.type")}</th>
            <th style={{ ...colHead, textAlign: "left" }}>{t("docs.description")}</th>
          </tr>
        </thead>
        <tbody>
          {entry.params.map((p) => (
            <tr key={p.name}>
              <td style={col}>
                {p.name}
                {p.default !== undefined && (
                  <span style={{ color: theme.accent, marginLeft: 4, fontFamily: theme.fontMono, fontSize: 11 }}>
                    = {p.default}
                  </span>
                )}
              </td>
              <td style={colMute}>{p.type}</td>
              <td style={{ ...colMute, fontFamily: theme.fontUI, fontSize: 12 }}>
                {isRu ? p.ru : p.en}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {entry.returns && (
        <div style={{ marginTop: 6, fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute }}>
          <span style={{ fontWeight: theme.weightHeader }}>{t("docs.returns")}: </span>
          <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.accent }}>{entry.returns.type}</span>
          {" — "}
          {isRu ? entry.returns.ru : entry.returns.en}
        </div>
      )}
    </div>
  );
}

function ExampleBlock({ code, theme }: { code: string; theme: Theme }) {
  const pre: CSSProperties = {
    margin: '8px 0 0',
    padding: '8px 10px',
    background: theme.editorBg ?? theme.panelHeader,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 5,
    fontFamily: theme.fontMono,
    fontSize: 11.5,
    lineHeight: 1.55,
    color: theme.panelTxt,
    whiteSpace: 'pre',
    overflowX: 'auto',
  };
  return <pre style={pre}>{code}</pre>;
}

function AdvancedNote({ entry, lang, theme }: { entry: DocEntry; lang: string; theme: Theme }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isRu = lang.startsWith('ru');
  if (!entry.advanced) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: 'unset', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: theme.fontUI, fontSize: 11, fontWeight: 700,
          color: theme.panelTxtMute,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', fontSize: 9 }}>▶</span>
        {t('docs.advanced')}
      </button>
      {open && (
        <div style={{ marginTop: 6, fontFamily: theme.fontUI, fontSize: 12.5, color: theme.panelTxtMute, lineHeight: 1.55 }}>
          {isRu ? entry.advanced.ru : entry.advanced.en}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  isOpen,
  onToggle,
  lang,
  theme,
}: {
  entry: DocEntry;
  isOpen: boolean;
  onToggle: () => void;
  lang: string;
  theme: Theme;
}) {
  const isRu = lang.startsWith("ru");
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          width: "100%",
          padding: "6px 14px 6px 14px",
          boxSizing: "border-box",
          borderBottom: `1px solid ${theme.panelBorder}`,
          background: isOpen ? theme.panelHeader : "transparent",
        }}
      >
        <span
          style={{
            marginTop: 3,
            color: theme.panelTxtMute,
            flexShrink: 0,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-block",
            fontSize: 10,
          }}
        >
          ▶
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.accent, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {entry.signature}
          </div>
          <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginTop: 1 }}>
            {isRu ? entry.ru : entry.en}
          </div>
        </div>
      </button>
      {isOpen && (
        <div
          style={{
            padding: "10px 14px 12px 14px",
            background: theme.surfacePanel,
            borderBottom: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{ fontFamily: theme.fontUI, fontSize: 13, color: theme.panelTxt, lineHeight: 1.5 }}>
            {isRu ? entry.ru : entry.en}
          </div>
          {entry.example && <ExampleBlock code={entry.example} theme={theme} />}
          <ParamTable entry={entry} lang={lang} theme={theme} />
          {entry.advanced && <AdvancedNote entry={entry} lang={lang} theme={theme} />}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  isOpen,
  onToggle,
  openEntry,
  onEntryToggle,
  lang,
  theme,
}: {
  category: DocCategory;
  isOpen: boolean;
  onToggle: () => void;
  openEntry: string | null;
  onEntryToggle: (id: string) => void;
  lang: string;
  theme: Theme;
}) {
  const isRu = lang.startsWith("ru");
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "8px 12px",
          boxSizing: "border-box",
          borderBottom: `1px solid ${theme.panelBorder}`,
          background: theme.panelHeader,
        }}
      >
        <span
          style={{
            color: theme.panelTxtMute,
            fontSize: 10,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-block",
            flexShrink: 0,
          }}
        >
          ▶
        </span>
        <span style={{ fontFamily: theme.fontUI, fontWeight: theme.weightHeader, fontSize: 12, color: theme.panelTxt, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {isRu ? category.ru : category.en}
        </span>
      </button>
      {isOpen &&
        category.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            isOpen={openEntry === entry.id}
            onToggle={() => onEntryToggle(entry.id)}
            lang={lang}
            theme={theme}
          />
        ))}
    </div>
  );
}

export default function DocsPanel({
  theme,
  lang,
  onClose,
}: {
  theme: Theme;
  lang: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["canvas"]));
  const [openEntry, setOpenEntry] = useState<string | null>(null);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEntry(id: string) {
    setOpenEntry((prev) => (prev === id ? null : id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PanelHeader title={t("docs.title")} theme={theme} onClose={onClose} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {DOCS.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            isOpen={openCategories.has(category.id)}
            onToggle={() => toggleCategory(category.id)}
            openEntry={openEntry}
            onEntryToggle={toggleEntry}
            lang={lang}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
