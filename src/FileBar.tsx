import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useEditor } from "./state/IdeState";
import { useThemeStore } from "./state/useTheme";
import { Icon } from "./components/Icons";
import { AuthSection } from "./components/user";

function FileTab({
  name,
  active,
  dirty,
  theme,
  onSelect,
  onClose,
  onRename,
}: {
  name: string;
  active: boolean;
  dirty: boolean;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
  onSelect: () => void;
  onClose: () => void;
  onRename: (newName: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        style={{
          height: active ? 38 : 32,
          padding: "0 14px",
          background: theme.tabActiveBg,
          borderRadius: theme.radiusTab,
          display: "inline-flex",
          alignItems: "center",
          marginRight: 4,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setEditing(false); setDraft(name); }
          }}
          onBlur={commitRename}
          style={{
            all: "unset",
            fontFamily: theme.fontUI,
            fontWeight: theme.weightUI + 100,
            fontSize: 13.5,
            color: theme.tabActiveTxt,
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      onDoubleClick={() => { setDraft(name); setEditing(true); }}
      style={{
        all: "unset",
        cursor: "pointer",
        height: active ? 38 : 32,
        padding: "0 14px",
        background: active
          ? theme.tabActiveBg
          : hover
            ? theme.tabInactiveHover
            : theme.tabInactiveBg,
        color: active ? theme.tabActiveTxt : theme.tabInactiveTxt,
        borderRadius: theme.radiusTab,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginRight: 4,
        fontFamily: theme.fontUI,
        fontWeight: active ? theme.weightUI + 100 : theme.weightUI,
        fontSize: 13.5,
        transition: "background 0.15s",
      }}
      title={name}
    >
      <span>{name}</span>
      {dirty && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 7,
            background: theme.tabDirty,
            boxShadow: `0 0 0 2px ${active ? theme.tabActiveBg : theme.filebarBg}`,
          }}
        />
      )}
      {active && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.panelTxtMute,
            marginLeft: 2,
          }}
        >
          <Icon name="close" size={12} color="currentColor" />
        </span>
      )}
    </button>
  );
}

function NewFileTab({ theme }: { theme: ReturnType<typeof useThemeStore.getState>["theme"] }) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const { t } = useTranslation();
  const changeFile = useEditor((s) => s.changeFile);
  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const project = useEditor((s) => s.project);

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setEditing(false); return; }
    const final = project.files[trimmed] ? `${trimmed}_new` : trimmed;
    changeFile(final, "");
    changeCurrentFile(final);
    setEditing(false);
    setName("");
  };

  if (editing) {
    return (
      <div
        style={{
          height: 38,
          padding: "0 14px",
          background: theme.tabActiveBg,
          borderRadius: theme.radiusTab,
          display: "inline-flex",
          alignItems: "center",
          marginRight: 4,
        }}
      >
        <input
          autoFocus
          value={name}
          placeholder={t('fileBar.untitled')}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          style={{
            all: "unset",
            fontFamily: theme.fontUI,
            fontSize: 13.5,
            color: theme.tabActiveTxt,
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setEditing(true)}
      title={t('fileBar.newFileTooltip')}
      style={{
        all: "unset",
        cursor: "pointer",
        height: 32,
        padding: "0 10px",
        background: hover ? theme.tabInactiveHover : theme.tabInactiveBg,
        color: theme.tabInactiveTxt,
        borderRadius: theme.radiusTab,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 2,
        transition: "background 0.15s",
      }}
    >
      <Icon name="plus" size={16} color="currentColor" />
    </button>
  );
}

export default function FileBar() {
  const theme = useThemeStore((s) => s.theme);
  const project = useEditor((s) => s.project);
  const currentFile = useEditor((s) => s.currentFile);
  const changeCurrentFile = useEditor((s) => s.changeCurrentFile);
  const deleteFile = useEditor((s) => s.deleteFile);
  const changeFile = useEditor((s) => s.changeFile);
  const dirtyFiles = useEditor((s) => s.dirtyFiles);
  const { t } = useTranslation();

  const files = Object.keys(project.files);

  const handleRename = (oldName: string, newName: string) => {
    const content = project.files[oldName];
    deleteFile(oldName);
    const target = project.files[newName] ? newName + "_new" : newName;
    changeFile(target, content);
    if (currentFile === oldName) {
      changeCurrentFile(target);
    }
  };

  return (
    <div
      style={{
        height: 44,
        background: theme.filebarBg,
        display: "flex",
        alignItems: "flex-end",
        padding: "0 12px 0 16px",
        gap: 0,
      }}
    >
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
        {files.map((name) => (
          <FileTab
            key={name}
            name={name}
            active={name === currentFile}
            dirty={dirtyFiles.has(name)}
            theme={theme}
            onSelect={() => changeCurrentFile(name)}
            onClose={() => {
              if (window.confirm(t('fileBar.deleteConfirm', { filename: name }))) {
                deleteFile(name);
              }
            }}
            onRename={(newName) => handleRename(name, newName)}
          />
        ))}
        <NewFileTab theme={theme} />
      </div>
      <AuthSection />
    </div>
  );
}
