import { useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Theme } from "../state/useTheme";
import { DOCS, type DocCategory, type DocEntry, type DocSwatch } from "../docs/graphicsDocs";
import { CONCEPTS, type DocConcept } from "../docs/concepts";
import { RECIPES, RECIPE_SECTIONS, type DocRecipe } from "../docs/recipes";
import { Icon } from "./Icons";

type TabId = "concepts" | "recipes" | "reference";

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

function TabBar({ active, onChange, theme }: { active: TabId; onChange: (t: TabId) => void; theme: Theme }) {
  const { t } = useTranslation();
  const tabs: { id: TabId; label: string }[] = [
    { id: "concepts", label: t("docs.tabConcepts") },
    { id: "recipes", label: t("docs.tabRecipes") },
    { id: "reference", label: t("docs.tabReference") },
  ];
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${theme.panelBorder}`, background: theme.panelHeader, flexShrink: 0 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              all: "unset",
              cursor: "pointer",
              flex: 1,
              textAlign: "center",
              padding: "8px 6px",
              fontFamily: theme.fontUI,
              fontWeight: theme.weightHeader,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: isActive ? theme.panelTxt : theme.panelTxtMute,
              borderBottom: isActive ? `2px solid ${theme.accent}` : "2px solid transparent",
              boxSizing: "border-box",
            }}
          >
            {tab.label}
          </button>
        );
      })}
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

function SwatchGrid({ swatches, theme }: { swatches: DocSwatch[]; theme: Theme }) {
  return (
    <div
      style={{
        marginTop: 8,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
        gap: 6,
      }}
    >
      {swatches.map((s) => {
        const [r, g, b] = s.rgb;
        const css = `rgb(${r}, ${g}, ${b})`;
        return (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px",
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: 4,
              background: theme.editorBg ?? theme.panelHeader,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: css,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.panelTxt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.name}
            </span>
          </div>
        );
      })}
    </div>
  );
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
  depth = 0,
}: {
  entry: DocEntry;
  isOpen: boolean;
  onToggle: () => void;
  lang: string;
  theme: Theme;
  depth?: number;
}) {
  const isRu = lang.startsWith("ru");
  const leftPad = 14 + depth * 14;
  const expandedLeftPad = 14 + depth * 14;
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
          padding: `6px 14px 6px ${leftPad}px`,
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
            padding: `10px 14px 12px ${expandedLeftPad}px`,
            background: theme.surfacePanel,
            borderBottom: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{ fontFamily: theme.fontUI, fontSize: 13, color: theme.panelTxt, lineHeight: 1.5 }}>
            {isRu ? entry.ru : entry.en}
          </div>
          {entry.example && <ExampleBlock code={entry.example} theme={theme} />}
          {entry.swatches && <SwatchGrid swatches={entry.swatches} theme={theme} />}
          <ParamTable entry={entry} lang={lang} theme={theme} />
          {entry.advanced && <AdvancedNote entry={entry} lang={lang} theme={theme} />}
        </div>
      )}
    </div>
  );
}

function NestedGroup({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginLeft: 12,
        borderLeft: `2px solid ${theme.panelBorder}`,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ label, isOpen, onToggle, theme }: { label: string; isOpen: boolean; onToggle: () => void; theme: Theme }) {
  return (
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
        {label}
      </span>
    </button>
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
      <SectionHeader label={isRu ? category.ru : category.en} isOpen={isOpen} onToggle={onToggle} theme={theme} />
      {isOpen && (
        <NestedGroup theme={theme}>
          {category.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isOpen={openEntry === entry.id}
              onToggle={() => onEntryToggle(entry.id)}
              lang={lang}
              theme={theme}
              depth={1}
            />
          ))}
        </NestedGroup>
      )}
    </div>
  );
}

function ConceptRow({ concept, isOpen, onToggle, lang, theme }: { concept: DocConcept; isOpen: boolean; onToggle: () => void; lang: string; theme: Theme }) {
  const isRu = lang.startsWith("ru");
  const side = isRu ? concept.ru : concept.en;
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
          padding: "8px 14px",
          boxSizing: "border-box",
          borderBottom: `1px solid ${theme.panelBorder}`,
          background: isOpen ? theme.panelHeader : "transparent",
        }}
      >
        <span style={{ marginTop: 3, color: theme.panelTxtMute, flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", fontSize: 10 }}>▶</span>
        <span style={{ fontFamily: theme.fontUI, fontSize: 13, color: theme.panelTxt, fontWeight: theme.weightHeader }}>{side.title}</span>
      </button>
      {isOpen && (
        <div style={{ padding: "10px 14px 12px 14px", background: theme.surfacePanel, borderBottom: `1px solid ${theme.panelBorder}` }}>
          <div style={{ fontFamily: theme.fontUI, fontSize: 13, color: theme.panelTxt, lineHeight: 1.55 }}>{side.body}</div>
          {concept.example && <ExampleBlock code={concept.example} theme={theme} />}
        </div>
      )}
    </div>
  );
}

function RecipeRow({
  recipe,
  isOpen,
  onToggle,
  openEntry,
  onEntryToggle,
  entryById,
  lang,
  theme,
}: {
  recipe: DocRecipe;
  isOpen: boolean;
  onToggle: () => void;
  openEntry: string | null;
  onEntryToggle: (id: string) => void;
  entryById: Map<string, DocEntry>;
  lang: string;
  theme: Theme;
}) {
  const isRu = lang.startsWith("ru");
  const side = isRu ? recipe.ru : recipe.en;
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
          padding: "8px 14px",
          boxSizing: "border-box",
          borderBottom: `1px solid ${theme.panelBorder}`,
          background: isOpen ? theme.panelHeader : "transparent",
        }}
      >
        <span style={{ marginTop: 3, color: theme.panelTxtMute, flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block", fontSize: 10 }}>▶</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: theme.fontUI, fontSize: 13, color: theme.panelTxt, fontWeight: theme.weightHeader }}>{side.title}</div>
          <div style={{ fontFamily: theme.fontUI, fontSize: 12, color: theme.panelTxtMute, marginTop: 1 }}>{side.intro}</div>
        </div>
      </button>
      {isOpen && (
        <NestedGroup theme={theme}>
          {recipe.entryIds.map((eid) => {
          const entry = entryById.get(eid);
          if (!entry) return null;
          return (
            <EntryRow
              key={`${recipe.id}:${eid}`}
              entry={entry}
              isOpen={openEntry === `${recipe.id}:${eid}`}
              onToggle={() => onEntryToggle(`${recipe.id}:${eid}`)}
              lang={lang}
              theme={theme}
              depth={2}
            />
          );
        })}
        </NestedGroup>
      )}
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
  const [tab, setTab] = useState<TabId>("recipes");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["canvas"]));
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [openConcept, setOpenConcept] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["drawing"]));
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [openRecipeEntry, setOpenRecipeEntry] = useState<string | null>(null);

  const entryById = useMemo(() => {
    const map = new Map<string, DocEntry>();
    for (const cat of DOCS) for (const e of cat.entries) map.set(e.id, e);
    return map;
  }, []);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PanelHeader title={t("docs.title")} theme={theme} onClose={onClose} />
      <TabBar active={tab} onChange={setTab} theme={theme} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "concepts" &&
          CONCEPTS.map((c) => (
            <ConceptRow
              key={c.id}
              concept={c}
              isOpen={openConcept === c.id}
              onToggle={() => setOpenConcept((prev) => (prev === c.id ? null : c.id))}
              lang={lang}
              theme={theme}
            />
          ))}

        {tab === "recipes" &&
          RECIPE_SECTIONS.map((section) => {
            const recipes = RECIPES.filter((r) => r.section === section.id);
            const isOpen = openSections.has(section.id);
            return (
              <div key={section.id}>
                <SectionHeader
                  label={lang.startsWith("ru") ? section.ru : section.en}
                  isOpen={isOpen}
                  onToggle={() => toggleSection(section.id)}
                  theme={theme}
                />
                {isOpen &&
                  recipes.map((r) => (
                    <RecipeRow
                      key={r.id}
                      recipe={r}
                      isOpen={openRecipe === r.id}
                      onToggle={() => {
                        setOpenRecipe((prev) => (prev === r.id ? null : r.id));
                        setOpenRecipeEntry(null);
                      }}
                      openEntry={openRecipeEntry}
                      onEntryToggle={(eid) => setOpenRecipeEntry((prev) => (prev === eid ? null : eid))}
                      entryById={entryById}
                      lang={lang}
                      theme={theme}
                    />
                  ))}
              </div>
            );
          })}

        {tab === "reference" &&
          DOCS.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              isOpen={openCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
              openEntry={openEntry}
              onEntryToggle={(id) => setOpenEntry((prev) => (prev === id ? null : id))}
              lang={lang}
              theme={theme}
            />
          ))}
      </div>
    </div>
  );
}
